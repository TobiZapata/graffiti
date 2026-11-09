import { collection, doc, onSnapshot, query, limit, runTransaction, serverTimestamp, setDoc } from 'firebase/firestore';

const LIMIT = 50, MAX_TEXT = 300, ICE_TIMEOUT = 12000, CONNECT_TIMEOUT = 20000;
export const validText = text => typeof text === 'string' && text.trim().length > 0 && text.length <= MAX_TEXT;
export const validMessage = m => m && typeof m.id === 'string' && m.id.length <= 100 && typeof m.uid === 'string' && m.uid.length <= 128 && typeof m.author === 'string' && m.author.length <= 100 && validText(m.text) && Number.isFinite(m.timestamp) && m.timestamp >= 0 && m.timestamp <= 8640000000000000;

export function createRoomChat({ uid, roomId, hostId, pageId, members, initialMessages = [], onMessages = () => {}, onStatus = () => {}, db }) {
  if (typeof globalThis.RTCPeerConnection !== 'function') {
    onMessages(initialMessages.filter(validMessage).slice(-LIMIT));
    onStatus({ state: 'unavailable', connectedPeers: 0, error: 'Chat is not supported by this browser.' });
    return { send: () => false, retry: () => {}, updateMembers: () => {}, close: () => {} };
  }
  let players = members, closed = false, generation = 0, unsubscribe = () => {}, peers = new Map();
  let messages = initialMessages.filter(validMessage).slice(-LIMIT), lastSent = new Map(), error;
  const isHost = uid === hostId;
  const signalCollection = collection(db, 'rooms', roomId, 'chatSignals');
  const member = id => players.find(p => p.uid === id && !p.left);
  const status = () => {
    if (closed) return;
    const connectedPeers = [...peers.values()].filter(p => p.channel?.readyState === 'open').length;
    onStatus({ state: isHost || connectedPeers ? 'connected' : error ? 'unavailable' : 'connecting', connectedPeers, ...(error ? { error } : {}) });
  };
  const add = m => {
    if (!validMessage(m) || messages.some(existing => existing.id === m.id)) return false;
    messages = [...messages, m].slice(-LIMIT); onMessages(messages); return true;
  };
  const transmit = (channel, data) => { if (channel?.readyState === 'open' && channel.bufferedAmount < 65536) { try { channel.send(JSON.stringify(data)); return true; } catch { return false; } } return false; };
  const broadcast = data => { for (const p of peers.values()) transmit(p.channel, data); };
  const accept = (sender, text) => {
    const player = member(sender), now = Date.now();
    if (!player || !validText(text) || now - (lastSent.get(sender) || 0) < 1000) return false;
    lastSent.set(sender, now);
    const author = String(player.name || player.teamName || 'Player').slice(0, 100);
    const message = { id: crypto.randomUUID(), uid: sender, author, text: text.trim(), timestamp: now };
    add(message); broadcast({ type: 'message', message }); return true;
  };
  const stopPeer = id => { const p = peers.get(id); if (!p) return; peers.delete(id); clearTimeout(p.timer); p.channel?.close(); p.pc.close(); };
  const fail = message => { error = message; status(); };
  const removeSignal = (id, connectionId) => runTransaction(db, async tx => {
    const ref = doc(signalCollection, id), latest = await tx.get(ref);
    if (latest.exists() && latest.data().connectionId === connectionId) tx.delete(ref);
  }).catch(() => {});
  const attach = (id, p, channel) => {
    p.channel = channel;
    channel.onopen = () => { if (peers.get(id) !== p) return; clearTimeout(p.timer); error = undefined; if (isHost) transmit(channel, { type: 'history', messages }); else removeSignal(uid, p.connectionId); status(); };
    channel.onclose = () => { if (peers.get(id) === p) { stopPeer(id); fail('Chat disconnected. Retry to reconnect.'); } };
    channel.onerror = () => { if (peers.get(id) === p) { stopPeer(id); fail('Chat connection failed. Retry to reconnect.'); } };
    channel.onmessage = event => {
      if (peers.get(id) !== p || !member(id) || typeof event.data !== 'string' || event.data.length > 32000) return;
      let data; try { data = JSON.parse(event.data); } catch { return; }
      if (!data || typeof data !== 'object') return;
      if (isHost && data.type === 'send') accept(id, data.text);
      if (!isHost && data.type === 'message') add(data.message);
      if (!isHost && data.type === 'history' && Array.isArray(data.messages) && data.messages.length <= LIMIT) data.messages.forEach(add);
    };
  };
  const createPeer = id => {
    stopPeer(id);
    // shortcut: no TURN relay, add one when restricted networks must support chat.
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    const p = { pc, channel: null, timer: null };
    peers.set(id, p);
    p.timer = setTimeout(() => { if (peers.get(id) === p && p.channel?.readyState !== 'open') { stopPeer(id); fail('Chat connection timed out. Retry to reconnect.'); } }, CONNECT_TIMEOUT);
    pc.onconnectionstatechange = () => { if (peers.get(id) === p && ['failed', 'closed'].includes(pc.connectionState)) { stopPeer(id); fail('Chat connection failed. Retry to reconnect.'); } };
    return p;
  };
  const gather = pc => new Promise((resolve, reject) => {
    if (pc.iceGatheringState === 'complete') return resolve();
    const timeout = setTimeout(() => { pc.removeEventListener('icegatheringstatechange', check); reject(new Error('Chat network discovery timed out.')); }, ICE_TIMEOUT);
    const check = () => { if (pc.iceGatheringState === 'complete') { clearTimeout(timeout); pc.removeEventListener('icegatheringstatechange', check); resolve(); } };
    pc.addEventListener('icegatheringstatechange', check); check();
  });
  const start = () => {
    const current = generation; error = undefined; status();
    if (isHost) {
      unsubscribe = onSnapshot(query(signalCollection, limit(8)), snapshot => {
        snapshot.docChanges().forEach(change => {
          const s = change.doc.data(), id = change.doc.id, player = member(id);
          if (closed || current !== generation || change.type === 'removed') return;
          if (!player || player.sessionId !== s.guestPageId || s.hostUid !== uid || s.guestUid !== id) { removeSignal(id, s.connectionId); return; }
          if ( typeof s.offer !== 'string' || s.offer.length > 32000 || typeof s.connectionId !== 'string' || s.connectionId.length > 100 || peers.get(id)?.connectionId === s.connectionId) return;
          let p;
          try { p = createPeer(id); } catch { fail('Chat connection could not be created.'); return; }
          p.connectionId = s.connectionId;
          (async () => {
            p.pc.ondatachannel = event => { if (!closed && current === generation && peers.get(id) === p && !p.channel) attach(id, p, event.channel); else event.channel.close(); };
            await p.pc.setRemoteDescription({ type: 'offer', sdp: s.offer });
            await p.pc.setLocalDescription(await p.pc.createAnswer()); await gather(p.pc);
            if (closed || current !== generation || peers.get(id) !== p) return;
            await runTransaction(db, async tx => {
              const ref = doc(signalCollection, id), latest = await tx.get(ref);
              if (!closed && current === generation && peers.get(id) === p && latest.exists() && latest.data().connectionId === s.connectionId && latest.data().guestPageId === s.guestPageId) tx.update(ref, { answer: p.pc.localDescription.sdp, hostPageId: pageId });
            });
          })().catch(() => { if (current === generation && !closed && peers.get(id) === p) { stopPeer(id); fail('Chat connection failed. Retry to reconnect.'); } });
        });
      }, () => { if (!closed && current === generation) fail('Chat signaling unavailable. Retry to reconnect.'); });
    } else {
      let p;
      try { p = createPeer(hostId); } catch { fail('Chat connection could not be created.'); return; }
      const connectionId = crypto.randomUUID(); p.connectionId = connectionId;
      (async () => {
        attach(hostId, p, p.pc.createDataChannel('chat'));
        const ref = doc(signalCollection, uid);
        unsubscribe = onSnapshot(ref, snapshot => {
          const s = snapshot.data();
          if (closed || current !== generation || peers.get(hostId) !== p || !s || s.connectionId !== connectionId || s.hostUid !== hostId || s.hostPageId !== member(hostId)?.sessionId || typeof s.answer !== 'string' || s.answer.length > 32000 || p.pc.remoteDescription) return;
          p.pc.setRemoteDescription({ type: 'answer', sdp: s.answer }).catch(() => { if (!closed && current === generation && peers.get(hostId) === p) fail('Chat connection failed. Retry to reconnect.'); });
        }, () => { if (!closed && current === generation && peers.get(hostId) === p) fail('Chat signaling unavailable. Retry to reconnect.'); });
        await p.pc.setLocalDescription(await p.pc.createOffer()); await gather(p.pc);
        if (closed || current !== generation || peers.get(hostId) !== p) return;
        await setDoc(ref, { guestUid: uid, hostUid: hostId, guestPageId: pageId, connectionId, offer: p.pc.localDescription.sdp, createdAt: serverTimestamp() });
      })().catch(() => { if (current === generation && !closed && peers.get(hostId) === p) { stopPeer(hostId); fail('Chat connection failed. Retry to reconnect.'); } });
    }
  };
  const reset = () => { generation++; unsubscribe(); unsubscribe = () => {}; for (const id of [...peers.keys()]) stopPeer(id); };
  onMessages(messages); start();
  return {
    send(text) {
      if (closed || !validText(text)) return false;
      if (isHost) return accept(uid, text);
      const now = Date.now();
      if (now - (lastSent.get(uid) || 0) < 1000 || !transmit(peers.get(hostId)?.channel, { type: 'send', text })) return false;
      lastSent.set(uid, now); return true;
    },
    retry() { if (!closed) { if (isHost) unsubscribe(); else reset(); start(); } },
    updateMembers(next) {
      const old = players; players = next;
      for (const id of [...peers.keys()]) if (!member(id) || old.find(p => p.uid === id)?.sessionId !== member(id)?.sessionId) stopPeer(id);
      if (!isHost && !peers.has(hostId)) error = 'Chat disconnected. Retry to reconnect.';
      if (isHost && !closed && JSON.stringify(old.map(p => [p.uid, p.sessionId, p.left])) !== JSON.stringify(next.map(p => [p.uid, p.sessionId, p.left]))) { unsubscribe(); start(); }
      else status();
    },
    close() { if (!closed) { closed = true; reset(); } },
  };
}
