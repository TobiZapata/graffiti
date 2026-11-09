"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useRoomSession } from "@/context/RoomSessionContext";
import { db } from "@/lib/firebase";
import { createRoomChat } from "@/lib/roomChat.mjs";

export default function RoomChat() {
  const { room, entry, userUid } = useRoomSession();
  const pathname = usePathname();
  if (!room || !entry || room.status === "closed" || !userUid ||
    !(pathname === `/room/${entry.roomId}` || pathname.startsWith(`/room/${entry.roomId}/`)) ||
    !room.players?.some(player => player.uid === userUid && !player.left)) return null;
  return <RoomChatPanel key={`${entry.roomId}:${userUid}`} room={room} entry={entry} uid={userUid} />;
}

function RoomChatPanel({ room, entry, uid }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState({ state: "connecting", connectedPeers: 0 });
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [lastRead, setLastRead] = useState(null);
  const transport = useRef(null);
  const history = useRef([]);
  const members = useRef(room.players);
  const input = useRef(null);
  const log = useRef(null);
  const launcher = useRef(null);
  const { roomId, pageId } = entry;
  const hostId = room.hostId;

  useEffect(() => {
    members.current = room.players;
    transport.current?.updateMembers(room.players);
  }, [room.players]);

  useEffect(() => {
    const chat = createRoomChat({ db, roomId, pageId, uid, hostId, members: members.current,
      initialMessages: history.current,
      onMessages: next => { history.current = next; setMessages(next); },
      onStatus: setStatus });
    transport.current = chat;
    return () => { transport.current = null; chat.close(); };
  }, [roomId, pageId, uid, hostId]);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  useEffect(() => {
    if (open && log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [open, messages]);

  const unread = open ? 0 : messages.slice(lastRead ? messages.findIndex(message => message.id === lastRead) + 1 : 0).filter(message => message.uid !== uid).length;
  const isHost = uid === hostId;
  const connected = status.state === "connected";
  const unavailable = status.state === "unavailable";
  const peers = room.players.filter(player => !player.left && player.uid !== uid).length;
  const description = unavailable ? "Chat unavailable" : !connected ? "Connecting chat…" : isHost && peers === 0 ? "Waiting for other players" :
    isHost ? `${status.connectedPeers} of ${peers} players connected` : "Connected to room chat";

  function toggle() {
    setLastRead(messages.at(-1)?.id || null);
    setOpen(!open);
    if (open) launcher.current?.focus();
  }

  function send(event) {
    event.preventDefault();
    if (!draft.trim()) return;
    try {
      if (!transport.current?.send(draft)) { setError("Message not sent. Check the connection or wait a moment before trying again."); return; }
      setDraft("");
      setError("");
      input.current?.focus();
    } catch {
      setError("Message not sent. Try reconnecting the chat.");
    }
  }

  return <aside className="fixed right-3 bottom-3 z-40 w-[360px] max-w-[calc(100%-24px)] sm:right-6 sm:bottom-6" aria-label="Room chat">
    {open && <section id="room-chat-panel" aria-labelledby="room-chat-title"
      className="mb-2 flex max-h-[calc(100dvh-100px)] w-full flex-col overflow-hidden rounded-xl border border-rule-strong bg-surface"
      onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); toggle(); } }}>
      <header className="flex items-start justify-between gap-3 border-b border-rule px-4 py-3">
        <div className="min-w-0">
          <h2 id="room-chat-title" className="text-[14px] font-medium">Room chat <span className="ml-1 text-ink-3">{roomId}</span></h2>
          <p role="status" className="mt-1 text-[12px] text-ink-2">{description}</p>
        </div>
        <button type="button" className="link min-h-9 px-1 text-[13px]" onClick={toggle} aria-label="Close room chat">Close</button>
      </header>
      {(unavailable || isHost && status.error) && <div className="border-b border-rule px-4 py-3 text-[13px] text-ink-2">
        <p>{unavailable ? "We couldn’t connect the chat. Your network or the host’s network may prevent the connection. You can keep playing." : "Some chat connections couldn’t be established. Other connected players can keep chatting."}</p>
        <button type="button" className="link mt-2 underline" onClick={() => { setError(""); transport.current?.retry(); }}>Reconnect chat</button>
      </div>}
      <div ref={log} role="log" aria-label="Chat messages" aria-live="polite" aria-relevant="additions"
        className="h-[280px] min-h-20 overflow-y-auto overscroll-contain px-4 py-3">
        {messages.length === 0 ? <p className="text-[13px] text-ink-3">Talk to the players in this room. Messages are kept only while the chat is open on a player’s device.</p> :
          <ol className="space-y-3">{messages.map(message => <li key={message.id}>
            <div className="flex items-baseline justify-between gap-3 text-[12px]">
              <span className="min-w-0 truncate font-medium text-ink-2">{message.author}{message.uid === uid ? " · you" : ""}</span>
              <time className="tabular shrink-0 text-ink-3" dateTime={new Date(message.timestamp).toISOString()}>{new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
            </div>
            <p className="mt-0.5 text-[14px] whitespace-pre-wrap [overflow-wrap:anywhere]">{message.text}</p>
          </li>)}</ol>}
      </div>
      <form className="border-t border-rule p-3" onSubmit={send}>
        <label htmlFor="room-chat-message" className="sr-only">Message to the room</label>
        <div className="flex items-center gap-2">
          <input ref={input} id="room-chat-message" className="field min-w-0 flex-1" autoComplete="off" maxLength={300}
            placeholder="Message the room…" value={draft} disabled={!connected}
            aria-describedby={error ? "room-chat-error" : undefined} onChange={event => setDraft(event.target.value)} />
          <button type="submit" className="btn btn-primary" disabled={!connected || !draft.trim()}>Send</button>
        </div>
        {error && <p id="room-chat-error" role="alert" className="mt-2 text-[12px] text-negative">{error}</p>}
      </form>
    </section>}
    <div className="flex justify-end">
      <button ref={launcher} type="button" aria-expanded={open} aria-controls="room-chat-panel" onClick={toggle}
        className="btn btn-secondary min-h-11 border border-rule-strong">
        Chat{unread > 0 && <span className="tabular">({unread} new)</span>}
        {unavailable && <span className="text-ink-3">· unavailable</span>}
      </button>
    </div>
  </aside>;
}
