import teams from '../data/teams.json' with { type: 'json' };
import countries from '../data/player-countries.json' with { type: 'json' };

const catalog = new Map(teams.flatMap(team => team.players.map(player => [String(player.id), player])));
const validCountry = value => typeof value === 'string' && /^[a-z]{2}$/i.test(value) ? value.toLowerCase() : null;

export function playerCountry(player) {
  if (!player) return null;
  const explicit = validCountry(player.country);
  if (explicit) return explicit;
  if (player.personId) return validCountry(countries.byPersonId[player.personId]);
  // Historical entry IDs keep homonyms such as the two steels separate.
  return validCountry(catalog.get(String(player.id))?.country ?? countries.byLegacyId[String(player.id)]);
}

export function playerOptionLabel(player) {
  const country = playerCountry(player);
  const flag = country && [...country.toUpperCase()].map(c => String.fromCodePoint(127397 + c.charCodeAt(0))).join('');
  return flag ? `${flag} ${player.name}` : player.name;
}
