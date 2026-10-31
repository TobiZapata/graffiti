"use client";

import { useRef, useState } from "react";
import { ROLE_FIELDS } from "@/lib/majorDisplay.mjs";

export default function RoomRolesDialog({ organization, assignRole, disabled, onOpen, onDone }) {
  const dialog = useRef(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function open() {
    setError("");
    setSaving(true);
    try { await onOpen(); dialog.current.showModal(); }
    catch (err) { setError(err.message || "Could not edit roles."); }
    finally { setSaving(false); }
  }

  async function done() {
    setSaving(true);
    setError("");
    try { await onDone(); dialog.current.close(); }
    catch (err) { setError(err.message || "Could not save roles to the room."); }
    finally { setSaving(false); }
  }

  return <>
    <button type="button" disabled={disabled || saving || !organization} className="btn btn-secondary" aria-haspopup="dialog" onClick={open}>Edit roles</button>
    {error && <p role="alert" className="text-negative">{error}</p>}
    <dialog ref={dialog} aria-labelledby="room-roles-title" onCancel={e => { if (saving) e.preventDefault(); }}
      className="m-auto w-[calc(100%_-_32px)] max-w-[480px] rounded-2xl bg-surface p-6 text-ink backdrop:bg-black/70">
      <h2 id="room-roles-title" className="text-[16px] font-medium">Edit roles</h2>
      <p className="mt-1 text-ink-2">Choose a player for each role. The AWPer and IGL swap when assigned to the same player.</p>
      <div className="mt-4 grid gap-4">
        {Object.entries(ROLE_FIELDS).map(([field, label]) => <label key={field} className="grid gap-1">
          <span>{label}</span>
          <select className="rounded-lg bg-control p-2 text-ink" value={organization?.[field] ?? ""} disabled={saving}
            onChange={e => { try { assignRole(field, e.target.value); setError(""); } catch (err) { setError(err.message); } }}>
            {organization?.squad.map((entry, index) => <option key={index} value={String(index)}>{entry.player.name}</option>)}
          </select>
        </label>)}
      </div>
      {error && <p role="alert" className="mt-4 text-negative">{error}</p>}
      <button type="button" className="btn btn-primary mt-6" disabled={saving} onClick={done}>{saving ? "Saving…" : "Done"}</button>
    </dialog>
  </>;
}
