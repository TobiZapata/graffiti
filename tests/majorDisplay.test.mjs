import test from 'node:test';
import assert from 'node:assert/strict';
import { playerAttributes, playerOverall, rosterPlayerAttribute, teamEvent } from '../src/lib/majorDisplay.mjs';

test('new player presentation exposes four visible scores and no overall or firepower', () => {
  const player = { awp: 95, rifler: 86, igl: 30, firepower: 94, clutch: 80 };
  assert.equal(playerOverall(player), null);
  assert.equal(playerAttributes(player), 'AWP 95 · Rifler 86 · IGL 30 · Clutch 80');
  assert.equal(playerOverall({ aim: 80, clutch: 60 }), 70);
  assert.equal(teamEvent({ major: 'PGL Major Krakow 2017' }), "Krakow '17");
});

test('roster shows both scores for shared AWPer and IGL roles', () => {
  const player = { awp: 95, rifler: 86, igl: 70 };
  const organization = { mainAwperUid: '0', iglUid: '1', starUid: '2' };
  assert.equal(rosterPlayerAttribute(player, organization, '0'), 'AWP 95');
  assert.equal(rosterPlayerAttribute(player, organization, '1'), 'IGL 70');
  assert.equal(rosterPlayerAttribute(player, organization, '2'), 'Rifler 86');
  assert.equal(rosterPlayerAttribute(player, { ...organization, iglUid: '0' }, '0'), 'AWP 95 · IGL 70');
  assert.equal(rosterPlayerAttribute({ awp: 0 }, { ...organization, iglUid: '0' }, '0'), 'AWP 0 · IGL —');
  assert.equal(rosterPlayerAttribute({}, organization, '2'), 'Rifler —');
});
