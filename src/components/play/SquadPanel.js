import { useState } from "react";
import PlayerIdentity from "@/components/PlayerIdentity";
import { ROLE_FIELDS } from "@/lib/majorDisplay.mjs";
import { draftPlayerStat } from "./draftFlow.mjs";
import teams from "@/data/teams.json";

const roleDragPrefix = "major-mvp-role:";

export default function SquadPanel({ squad, roles = null, onRoleChange }) {
  const [selectedRole, setSelectedRole] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const open = Math.max(0, 5 - squad.length);
  function moveRole(field, uid) {
    if (!Object.hasOwn(ROLE_FIELDS, field) || !onRoleChange) return;
    onRoleChange(field, uid);
    setSelectedRole(null); setDropTarget(null);
  }
  return (
    <section className="card self-start p-5" aria-labelledby="squad-title">
      <div className="flex items-baseline justify-between">
        <h2 id="squad-title" className="text-[16px] font-medium">Your squad</h2>
        <span className="meta tabular">{squad.length} of 5</span>
      </div>
      {onRoleChange && <p className="meta mt-2">Drag a role onto another player, or select the role and then the player. The AWPer and IGL can be the same player.</p>}
      <ol className="mt-4 grid gap-1">
        {squad.map((slot, index) => {
          const uid = String(index);
          return (
            <li key={slot.player.id ?? slot.player.name} data-player-uid={uid}
              className={`flex min-h-16 items-center gap-3 rounded-lg px-3 py-2 ${dropTarget === uid ? "bg-control" : "bg-raised"}`}
              onDragOver={event => {
                if (!onRoleChange || !event.dataTransfer.types.includes("text/plain")) return;
                event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDropTarget(uid);
              }}
              onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDropTarget(null); }}
              onDrop={event => {
                event.preventDefault(); const payload = event.dataTransfer.getData("text/plain");
                if (payload.startsWith(roleDragPrefix)) moveRole(payload.slice(roleDragPrefix.length), uid);
                setDropTarget(null);
              }}>
              <button type="button" disabled={!selectedRole} onClick={() => moveRole(selectedRole, uid)}
                className={`min-w-0 flex-1 text-left ${selectedRole ? "cursor-pointer underline underline-offset-4" : "cursor-default"}`}
                aria-label={selectedRole ? `Make ${slot.player.name} the ${ROLE_FIELDS[selectedRole]}` : slot.player.name}>
                <span className="block truncate font-medium"><PlayerIdentity player={slot.player} /></span>
                <span className="block text-[12px] tabular text-ink-2">{draftPlayerStat(slot.player, teams.find(team => team.name === slot.team?.name && team.major === slot.team?.major), roles, index)}</span>
                {slot.team && <span className="meta block">{slot.team.name} · {slot.team.major}</span>}
              </button>
              {roles && <span className="flex shrink-0 flex-wrap justify-end gap-1">
                {Object.entries(ROLE_FIELDS).filter(([field]) => roles[field] === uid).map(([field, label]) =>
                  <button type="button" key={field} data-role={field} draggable={!!onRoleChange}
                    className={`h-7 cursor-grab rounded-md px-2 text-[12px] font-medium active:cursor-grabbing ${selectedRole === field ? "bg-ink text-black" : "bg-control"} ${field === "starUid" && selectedRole !== field ? "text-accent" : ""}`}
                    aria-label={`Move ${label} from ${slot.player.name}`} aria-pressed={selectedRole === field}
                    onClick={() => setSelectedRole(selectedRole === field ? null : field)}
                    onDragStart={event => { event.dataTransfer.setData("text/plain", roleDragPrefix + field); event.dataTransfer.effectAllowed = "move"; setSelectedRole(field); }}
                    onDragEnd={() => { setSelectedRole(null); setDropTarget(null); }}>{label}</button>)}
              </span>}
            </li>
          );
        })}
        {Array.from({ length: open }, (_, i) => (
          <li key={`open-${i}`} className="flex h-12 items-center rounded-lg px-3 text-ink-3 outline outline-1 -outline-offset-1 outline-rule-strong outline-dashed">Open slot</li>
        ))}
      </ol>
      {selectedRole && <p className="meta mt-3" role="status">Choose the new {ROLE_FIELDS[selectedRole]}. <button type="button" className="link underline" onClick={() => setSelectedRole(null)}>Cancel</button></p>}
    </section>
  );
}
