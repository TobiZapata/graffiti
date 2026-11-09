import { isV2Player } from './playerModel.mjs';

// Only verified historical entries are replaced; uncalibrated Majors keep their snapshots.
export function upgradeOrganization(organization, catalog) {
  let changed = false;
  const upgradeSlot = slot => {
    if (isV2Player(slot.player)) return slot;
    const team = catalog.find(team => team.name === slot.team?.name && team.major === slot.team?.major);
    const player = team?.players.find(player => player.id === slot.player.id);
    if (!player || player.name !== slot.player.name || (slot.player.personId && player.personId !== slot.player.personId)) return slot;
    changed = true;
    return { ...slot, player: { ...player } };
  };
  const squad = organization.squad.map(upgradeSlot);
  const bench = organization.bench ? upgradeSlot(organization.bench) : organization.bench;
  return changed ? { ...organization, squad, ...(organization.bench !== undefined ? { bench } : {}) } : organization;
}
