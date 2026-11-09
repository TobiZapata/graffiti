import { isV2Player, validateV2Player } from './playerModel.mjs';

const stats = ['aim', 'positioning', 'composure', 'rating', 'gamesense'];
const hasRole = (player, role) => [player.role, player.rol1, player.rol2].some(value => typeof value === 'string' && value.toUpperCase() === role);

export function prepareReplayTeam(team) {
  if (!team || typeof team.name !== 'string' || !team.name.trim() || !Array.isArray(team.players) || team.players.length !== 5) throw new Error('Cada equipo necesita un nombre y cinco jugadores');
  const names = new Set(), ids = new Set();
  const players = team.players.map((player, index) => {
    if (!player || typeof player.name !== 'string' || !player.name.trim() || names.has(player.name.trim())) throw new Error('Los nombres de jugadores deben ser únicos y no estar vacíos');
    names.add(player.name.trim());
    let uid = String(player.uid ?? player.id ?? index).trim();
    if (!uid || ids.has(uid)) { uid = `slot-${index}`; while (ids.has(uid)) uid += '-'; }
    ids.add(uid);
    const result = { ...player, uid };
    if (isV2Player(result)) { validateV2Player(result); return result; }
    for (const stat of stats) {
      if (result[stat] !== undefined) {
        const value = Number(result[stat]);
        result[stat] = Number.isFinite(value) ? Math.max(1, Math.min(100, value)) : 80;
      }
    }
    return result;
  });
  const explicit = field => {
    if (team[field] === undefined) return undefined;
    const uid = String(team[field]);
    if (!players.some(player => player.uid === uid)) throw new Error(`Identificador inválido: ${field}`);
    return uid;
  };
  let awper = explicit('mainAwperUid'), igl = explicit('iglUid');
  const choose = (role, excluded, stat) => players.filter(p => p.uid !== excluded).sort((a, b) => Number(hasRole(b, role)) - Number(hasRole(a, role)) || (b[stat] ?? b.rating ?? 80) - (a[stat] ?? a.rating ?? 80))[0].uid;
  const v2 = players.every(isV2Player);
  awper ??= choose('AWPER', v2 ? undefined : igl, v2 ? 'awp' : 'aim');
  igl ??= choose('IGL', v2 ? undefined : awper, v2 ? 'igl' : 'gamesense');
  return { ...team, players, mainAwperUid: awper, iglUid: igl };
}
