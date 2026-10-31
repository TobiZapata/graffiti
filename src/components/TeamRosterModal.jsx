"use client";

import { useEffect, useRef } from "react";
import { playerOverall, roleLabel } from "@/lib/majorDisplay.mjs";

export default function TeamRosterModal({ team, onClose }) {
  const dialog = useRef(null);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (team && !el.open) el.showModal();
    if (!team && el.open) el.close();
  }, [team]);

  return (
    <dialog ref={dialog} onClose={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      aria-labelledby="roster-title"
      className="m-auto w-[min(440px,calc(100%-32px))] rounded-2xl bg-surface p-6 text-ink backdrop:bg-black/70">
      {team && <>
        <header className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-raised p-2">
            {team.icon
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={team.icon} alt="" className="max-h-full max-w-full object-contain" />
              : <span className="text-ink-2">{team.name.slice(0, 3)}</span>}
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="roster-title" className="truncate text-[20px] font-medium">{team.name}</h2>
            {team.major && <p className="meta truncate">{team.major}</p>}
          </div>
          <button type="button" onClick={onClose} className="link self-start">Close</button>
        </header>
        <table className="mt-4 w-full text-left">
          <thead><tr className="meta h-9"><th scope="col" className="font-normal">Player</th><th scope="col" className="font-normal">Role</th><th scope="col" className="text-right font-normal">Overall</th></tr></thead>
          <tbody>
            {team.players?.map((p, i) => (
              <tr key={p.uid || i} className="h-11 border-t border-rule">
                <td className="font-medium">{p.name}</td>
                <td className="text-ink-2">{roleLabel(p.role)}</td>
                <td className="tabular text-right">{playerOverall(p) ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>}
    </dialog>
  );
}
