import test from 'node:test';
import assert from 'node:assert/strict';
import teams from '../src/data/teams.json' with { type: 'json' };
import legacy from '../src/data/teams-legacy.json' with { type: 'json' };
import { playerCountry, playerOptionLabel } from '../src/lib/playerCountry.mjs';
import { summarizeMatchPlayers } from '../src/lib/matchSummary.mjs';

test('all active and archived identities resolve a country without guessing from nicknames', () => {
  for (const team of teams) for (const player of team.players) {
    assert.match(player.country, /^[a-z]{2}$/);
    assert.equal(playerCountry(player), player.country);
    const { country, ...old } = player;
    assert.equal(playerCountry(old), country);
  }
  for (const team of legacy) for (const player of team.players) assert.match(playerCountry(player), /^[a-z]{2}$/, `${team.name}/${player.name}`);
  const steel = legacy.flatMap(t => t.players).find(p => p.name === 'steel');
  assert.equal(playerCountry(steel), 'ca');
  assert.equal(playerCountry({ personId: 'steel' }), 'br');
  assert.equal(playerCountry({ name: 'steel' }), null);
  assert.equal(playerCountry({ name: 'future', id: 1, personId: 'future-unknown' }), null);
});

test('future players use their own country and malformed values never become asset paths', () => {
  assert.equal(playerCountry({ country: 'AR', name: 'new' }), 'ar');
  assert.equal(playerCountry({ country: '../../x', name: 'new' }), null);
  assert.equal(playerCountry(null), null);
  assert.equal(playerOptionLabel({ country: 'se', name: 'JW' }), '\u{1F1F8}\u{1F1EA} JW');
  assert.equal(playerOptionLabel({ name: 'Unknown' }), 'Unknown');
});

test('final scoreboard rows keep nationality identity without changing saved statistics', () => {
  const match = { teamA: teams[0], teamB: teams[1] };
  const summary = summarizeMatchPlayers(match, []);
  assert.equal(summary.teamA[0].country, teams[0].players[0].country);
  assert.equal(summary.teamA[0].personId, teams[0].players[0].personId);
  assert.equal(summary.teamA[0].kills, null);
});
