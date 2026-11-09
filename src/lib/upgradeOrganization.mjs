import { isV2Player } from './playerModel.mjs';

// Only verified historical entries are replaced; uncalibrated Majors keep their snapshots.
export function upgradeOrganization(organization, catalog) {
  let changed = false;
  const squad = organization.squad.map(slot => {
    if (isV2Player(slot.player)) return slot;
    const team = catalog.find(team => team.name === slot.team?.name && team.major === slot.team?.major);
    const player = team?.players.find(player => player.id === slot.player.id);
    if (!player) return slot;
    changed = true;
    return { ...slot, player: { ...player } };
  });
  return changed ? { ...organization, squad } : organization;
}
