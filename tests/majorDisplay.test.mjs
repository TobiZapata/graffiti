import test from 'node:test';
import assert from 'node:assert/strict';
import { playerAttributes, playerOverall, teamEvent } from '../src/lib/majorDisplay.mjs';

test('new player presentation exposes four visible scores and no overall or firepower', () => {
  const player = { awp: 95, rifler: 86, igl: 30, firepower: 94, clutch: 80 };
  assert.equal(playerOverall(player), null);
  assert.equal(playerAttributes(player), 'AWP 95 · Rifler 86 · IGL 30 · Clutch 80');
  assert.equal(playerOverall({ aim: 80, clutch: 60 }), 70);
  assert.equal(teamEvent({ major: 'PGL Major Krakow 2017' }), "Krakow '17");
});
