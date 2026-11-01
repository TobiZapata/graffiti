import test from 'node:test';
import assert from 'node:assert/strict';
import { draftOffer, readDraft, removePick } from '../src/lib/draftState.mjs';

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
