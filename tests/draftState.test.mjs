import test from 'node:test';
import assert from 'node:assert/strict';
import { draftOffer, readDraft, removePick, sameDraftPlayer } from '../src/lib/draftState.mjs';

const teams = [1, 2, 3, 4, 5, 6].map(id => ({ id, name: `team${id}`, major: 'event', players: [{ name: `player${id}` }] }));
const slot = id => ({ player: { name: `player${id}` }, team: { name: `team${id}`, major: 'event' } });
const offer = draft => draftOffer(draft.seed, draft.squad.length, draft.rerollsLeft, teams);

test('undo and repeated picks cannot generate a new offer, including after reload', () => {
  const draft = { seed: 'fixed', squad: [slot(1)], rerollsLeft: 3 };
  const expected = offer(draft);
  const undone = removePick(draft, 0);
  for (let i = 0; i < 3; i++) assert.deepEqual(offer({ ...undone, squad: [slot(1)] }), expected);
  assert.deepEqual(offer(readDraft(JSON.parse(JSON.stringify(draft)), teams)), expected);
});

test('paid rerolls stay spent when removing a pick', () => {
  const draft = { seed: 'fixed', squad: [slot(1), slot(2)], rerollsLeft: 1 };
  const undone = removePick(draft, 0);
  assert.equal(undone.rerollsLeft, 1);
  assert.deepEqual(offer(undone), draftOffer('fixed', 0, 1, teams));
});

test('legacy squads survive and invalid stored data is rejected or bounded', () => {
  assert.equal(readDraft({ squad: [slot(1)], rerollsLeft: 2 }, teams).squad.length, 1);
  assert.equal(readDraft({ squad: [slot(9)], rerollsLeft: 3 }, teams), null);
  const draft = readDraft({ squad: [slot(1)], rerollsLeft: 99, seed: {} }, teams);
  assert.equal(draft.rerollsLeft, 0);
  assert.equal(draft.seed, null);
});

test('historical IDs resolve renamed entries and person identity prevents alias duplicates', () => {
  const catalog = [{ name: 'A', major: 'old', players: [{ id: 10, name: 'znajder', personId: 'znajder' }] }, { name: 'B', major: 'new', players: [{ id: 20, name: 'schneider', personId: 'znajder' }] }];
  const first = { team: { name: 'A', major: 'old' }, player: { id: 10, name: 'schneider' } };
  assert.equal(readDraft({ squad: [first], rerollsLeft: 1, seed: 'fixed' }, catalog).squad[0].player.name, 'znajder');
  assert.equal(readDraft({ squad: [first, { team: { name: 'B', major: 'new' }, player: { id: 20 } }] }, catalog), null);
  assert.equal(sameDraftPlayer({ personId: 'adren-kz', name: 'AdreN' }, { personId: 'adren-us', name: 'adreN' }), false);
});

test('legacy draft keeps original catalog stats and spent rerolls after catalog replacement', () => {
  const legacy = [{ name: 'A', major: 'old', players: [{ id: 1, name: 'P', aim: 71 }] }];
  const current = [{ name: 'A', major: 'old', players: [{ id: 1, name: 'P', personId: 'person-p', awp: 90 }] }];
  const result = readDraft({ squad: [{ team: { name: 'A', major: 'old' }, player: legacy[0].players[0] }], seed: 'fixed', rerollsLeft: 1 }, current, legacy);
  assert.equal(result.squad[0].player.aim, 71);
  assert.equal(result.squad[0].player.personId, 'person-p');
  assert.equal(result.rerollsLeft, 1);
  assert.equal(result.seed, 'fixed');
});
