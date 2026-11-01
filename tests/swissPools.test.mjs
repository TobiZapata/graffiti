import test from "node:test";
import assert from "node:assert/strict";
import { poolsByRecord } from "../src/lib/swissPools.mjs";

test("reconstructs historical pools after later rounds mutate team records, including saved games", () => {
  const a = { id: "a", wins: 0, losses: 0 };
  const b = { id: "b", wins: 0, losses: 0 };
  const c = { id: "c", wins: 0, losses: 0 };
  const d = { id: "d", wins: 0, losses: 0 };
  const match = (round, teamA, teamB, winner) => ({ round, teamA, teamB, completed: true, result: { winner } });
  const matches = [match(1, a, b, "a"), match(1, c, d, "c"), match(2, a, c, "a"), match(2, b, d, "b"), match(3, a, b, "a")];
  Object.assign(a, { wins: 3, losses: 0 });
  Object.assign(b, { wins: 1, losses: 2 });
  Object.assign(c, { wins: 1, losses: 1 });
  Object.assign(d, { wins: 0, losses: 2 });

  for (const history of [matches, JSON.parse(JSON.stringify(matches))]) {
    const pools = poolsByRecord([...history].reverse());
    assert.deepEqual(pools["0-0"].map(m => m.round), [1, 1]);
    assert.equal(pools["1-0"][0].round, 2);
    assert.equal(pools["0-1"][0].round, 2);
    assert.equal(pools["2-0"][0].round, 3);
  }
});

test("does not count incomplete or playoff matches as Swiss results", () => {
  const a = { id: "a" }, b = { id: "b" };
  const pools = poolsByRecord([
    { round: 1, teamA: a, teamB: b, completed: false, result: null },
    { round: "Final", teamA: a, teamB: b, completed: true, result: { winner: "a" } },
    { round: 2, teamA: a, teamB: b, completed: false, result: null },
  ]);
  assert.equal(pools["0-0"].length, 2);
});
