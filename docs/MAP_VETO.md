# Pre-match map veto against NPC

Branch: `feat/npc-map-veto`, based on `feat/seven-map-rotation` at `295df89`.

New human-versus-NPC matches enter a veto before replay assembly. This applies
to the local Major and room matches with exactly one human participant. Matches
between two humans retain their current flow; no shared veto state or Firestore
rules were added. Starting T/CT behavior is unchanged.

## Sequence

The first team is chosen deterministically from the tournament/match seed.
A below means this first team, not necessarily the player's team.

| Series | Actions | Played maps |
| --- | --- | --- |
| BO1 | A bans two, B bans three, A bans one | Remaining map |
| BO3 | A ban, B ban, A pick, B pick, B ban, A ban | Two picks, then decider |
| BO5 | A ban, B ban, A pick, B pick, B pick, A pick | Four picks, then decider |

NPC replies are seeded choices from the available maps; they do not use invented
map strengths. All seven maps participate. A map cannot be selected twice.
The human acts only for their team, whether that team occupies slot A or B.

The UI shows map icons, available/banned/picked states, action history, and the
final play order. Start match is available only after the veto is complete.
A series stops when a team wins the required number of maps; unused picks are
not played.

## Persistence and compatibility

Each human action and its NPC responses save a versioned `veto` action log with
`vetoStarted: false` through the existing career or room playback storage.
Reloading resumes the same veto. Starting saves `vetoStarted: true` and the first
map. Playback saves retain the complete veto, and the next map follows its order.
The progress validator checks turn/action order, unique known map IDs, series
format, history prefix and current map. A pending veto cannot contain playback
or completed map history.

Existing progress without a veto retains its original single-map behavior,
including descriptor-free saves and Dust2's legacy bank. Completed matches are
not reopened for a veto. The local match route refuses matches without a player,
so opening a match between NPCs cannot create invalid career progress.

## Validation

- Full suite: 241 tests passed; final veto/save checks: 26 tests passed.
- ESLint passed for the changed JavaScript/JSX files; production Webpack build passed.
- Chrome: BO1, BO3 and BO5 completed their veto; partial and completed vetoes
  survived reload, playback did not begin before confirmation, and playback
  resumed after starting. BO3/BO5 advanced to the next distinct map and resumed it
  after reload. Real banks/replays were used. Published-bank URLs were fulfilled
  from their local imported files for this isolated browser check.
- Screenshots at 1440, 768 and 390 px show no horizontal overflow. Browser contexts
  were isolated; no user career or cloud match result was modified.

Evidence in CS2 Data Lab: `output/npc-veto-browser.json`, `output/npc-veto-*.png`,
`output/npc-veto-inspect/report.json`, and the reproducible
`output/check-npc-veto-browser.mjs` with `output/veto-browser-fixtures.json`.

## Interface review

The screen keeps the existing true-black-flat style and Inter typography
(design skill seed 1914651052, existing palette/type preserved). Its question is
which map to ban or pick next. The recognizable map badges and the ordered veto
history carry the product identity; there is no sample UI data to replace.
Source design lint: no failures/warnings. Snapshot inspection at three widths:
no failures, one font warning caused by opening the saved snapshot as a file;
the live browser screenshots use the app's existing self-hosted font.

The banks remain local. This branch has not been deployed or merged; initial
small banks can still exhaust replay coverage for some team/seed combinations.
