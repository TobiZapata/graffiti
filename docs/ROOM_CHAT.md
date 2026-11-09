# Room chat

The room chat stays mounted in `Providers` while navigating between the lobby,
Major and match pages. Each guest opens one WebRTC data channel to the room host;
the host attributes incoming text to that connection's member and relays messages.
Firebase carries connection offers and answers, never chat messages.

Signaling uses `rooms/{roomId}/chatSignals/{guestUid}`. Offers are bound to the
current host and guest page session. Only the current host can answer, and only
that guest or the host can read the document. Successful connections remove their
signal; the host also removes stale offers so they cannot fill its limited query.
Cleanup is best effort if a device disconnects abruptly.

Messages are plain text, up to 300 characters, with one message per second per
sender enforced by the host. Each device keeps the latest 50 messages in memory.
New connections receive the host's history. When the host changes during a Major,
remaining devices reconnect and the new host keeps its local history. Chat history
is not durable and messages during a disconnection are not guaranteed to arrive.
Leaving the room destroys the local chat instance.

The browser uses STUN to discover connection routes, without TURN or paid relay
services. Networks that prevent a direct connection get a reconnect option and
can continue playing. A browser without WebRTC cannot use chat. The host can read
and relay chat text; WebRTC does not make a player-controlled host authoritative
or trustworthy. Room membership continues to be enforced by Firebase rules.

## Validation and release

- `npm run test:replay`: chat input validation plus the existing unit tests.
- `npm run test:firestore`: signaling permissions in the local emulator.
- `ROOMS_TEST_BASE=http://127.0.0.1:3100 ROOMS_TEST_OUTPUT=<directory> node scripts/check-room-chat.mjs`:
  browser checks against local Firebase emulators and Chrome CDP on port 9223.
- `npm run lint` and `npm run build`.

Deploy `firestore.rules` to `graffity-major` before releasing the frontend.
Signaling consumes Firebase operations on connection, cleanup and reconnection;
sending chat messages consumes no Firestore operations.
