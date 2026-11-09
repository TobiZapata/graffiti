# Final scoreboard metrics v1

The final scoreboard displays Player, K-D, Swing, ADR, KAST and Rating, sorted
by rating. Individual maps and the full series use the same calculations.
Player aptitude scores and match results are unchanged: these are observed
performance metrics, not new roster attributes or inputs to round selection.

## Calculation

- K-D retains the existing bank statistics, including the observed round tail.
- ADR is actual enemy health damage / rounds. Damage is capped by the victim's
  remaining health, excluding overkill, team damage, self damage and bomb damage.
  Enemy damage in the recorded post-resolution tail is included. This treatment
  has not been verified to be identical to HLTV's treatment of every tail event.
- KAST is the percentage of rounds with at least one kill, credited assist
  (including flash), survival, or a traded death. A trade requires a teammate
  to kill the killer within five seconds, no later than round resolution.
  Each player receives at most one KAST round. Survival follows the source bank.
- Swing uses an editorial alive-count matrix: P(win) = ownAlive^2 /
  (ownAlive^2 + enemyAlive^2), with terminal states 0 and 1. Each enemy kill
  credits the attacker with the before/after difference and debits the victim
  equally. Utility kills can credit an already dead attacker. The calculation
  stops at resolution; bomb deaths and team kills receive no personal credit.
  Displayed swing is net percentage points per round, shown with a percent sign.
  All ten players sum to zero before display rounding.

Rating is the simulator's own formula, not HLTV Rating 2.0 or 3.0:

```text
max(0, 1
  + 0.55 * (kills/rounds - 0.65)
  - 0.40 * (deaths/rounds - 0.65)
  + 0.15 * (assists/rounds - 0.15)
  + 0.003 * (ADR - 75)
  + 0.004 * (KAST - 70)
  + 0.015 * swing)
```

These baselines and weights are game calibration choices. Rating has no upper
cap. There are no champion, MVP, role or sample-size bonuses. A series adds raw
totals and rounds first, then calculates its rates; it never averages rounded
map ratings or percentages. Kills, swing and damage are correlated on purpose,
so the weights are modest rather than treating them as independent evidence.

## Bank and storage

`npm run bank:metrics` builds `public/round-metrics-v1.json.gz` from the local
economy index and verified replay bytes. Run it after importing/extending the
bank. Ship this small sidecar with the web app, even when the main bank is hosted
elsewhere. It contains 932 supported rounds and occupies 86,496 bytes compressed.
It does not require downloading full animations to calculate the final table.
Each source entry contains its replay SHA256 and actor metrics. Runtime verifies
the provenance before moving those metrics to the final player assignments.
Do not overwrite the v1 calculation with a different formula; introduce a new
metrics version when historical interpretation changes.

Local map summaries add `damage`, `kastRounds`, and `swingTotal` to each player's
existing uid/kills/deaths/assists/flashAssists record. `swingTotal` is an integer
in hundredths of a percentage point. Validation accepts the old five-field
records and the complete eight-field records; incomplete extended records fail.

Online result documents keep their existing compact score-only contract and
Firestore rules. As before, the final display reconstructs deterministic rounds
from the saved simulation version, now attaching compact metrics as well.
Existing local summaries can also recover missing metrics when their generated
score and any saved K/D/A/FA records match. Different saved statistics are never
substituted. This safeguard does not prove source-round identity for old records
that did not store provenance. If the bank or sidecar
is unavailable, finishing/saving remains possible, K-D stays available and
missing detailed statistics display a dash rather than invented values.

## Plausibility check, 2026-11-05

`node scripts/calibrate-match-metrics.mjs` records forty seeded real-bank
simulations (400 player-map rows) and three complete example scoreboards in
`docs/fixtures/match-metrics-calibration.json`. The reference fixture contains
twenty transcribed player-map rows from Anubis in
[Apeks-G2, Paris Major 2023](https://www.hltv.org/matches/2363848/apeks-vs-g2-blasttv-paris-major-2023-challengers-stage)
and [NAVI-G2, World Final 2023](https://www.hltv.org/matches/2368524/natus-vincere-vs-g2-blast-premier-world-final-2023).
The first page reports Rating 2.0; the second currently reports Rating 3.0.

| Metric | Simulator mean | Reference mean | Simulator middle 80% |
| --- | ---: | ---: | ---: |
| ADR | 74.445 | 72.050 | 49.909-98.938 |
| KAST | 73.370% | 72.935% | 60.714-85.714% |
| Rating | 1.025 | 1.057 | 0.657-1.396 |
| Swing | 0 | 0 | -5.658 to +6.424 pp/round |

The simulator's rating extremes were 0.319-2.053, ADR 33.783-133.579 and KAST
40-100%. Swing reached -12.819/+17.609, visibly broader than the ten reference
rows with available swing (-4.05/+4.74). We did not conceal or clamp these tails.
The simulated means and ordinary rating range look plausible; this is not proof
of equivalent accuracy, matching rank order, or matching whole distributions.
The samples differ in map, roster, era and size, and the references mix rating
versions. No coefficients were fitted to force these twenty rows to match.

The largest remaining model limitation is swing: it ignores bomb state, time,
map, side and equipment and assigns the full alive-count delta to the frag.
HLTV's contextual model and credit distribution differ. See HLTV's
[Rating 3.0 introduction](https://www.hltv.org/news/42485/introducing-rating-30).

Verification: 158 replay/application tests pass, including real-bank metrics,
backward-compatible saved results and round-weighted series aggregation. Build
passes; lint has zero errors and the existing thirteen unrelated warnings.
Chrome smoke tested draft through match completion, metric persistence/reload,
and 1440/768/390 widths; Firebase endpoints were blocked. No cloud deployment.

Career roster ratings now average completed series ratings. Offline results retain
map metrics; online submissions retain ten compact `playerRatings` values ordered
by team A's five roster slots followed by team B's five slots. Firestore validates
the optional array and accepts legacy submissions without it. Full online display
metrics still regenerate from replay data. Missing historical ratings remain unknown.
