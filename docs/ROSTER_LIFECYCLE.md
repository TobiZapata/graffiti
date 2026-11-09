# Roster lifecycle

An organization has five starters and at most one substitute. Its roster and its
Major snapshots are separate: changing a player never rewrites an old match.

## Between Majors

- The bench unlocks on the first completed Major. Each completion sets the token
  balance to one, never two. Existing careers with completed Majors receive one
  token when upgrading; their historical Majors are not replayed for departures.
- Moving a starter into an empty bench costs one token and opens a starter vacancy.
  A full bench must be emptied by promoting or releasing its player first.
- Swapping a starter with the substitute is unlimited and free. Promoting the
  substitute into a vacancy and releasing the substitute are also free.
- Vacancies use the existing three-team draft. Offers are deterministic across
  reloads, exclude teams with no eligible players and change after a signing.
  There is no replacement currency or paid reroll system in this version.
- Duplicate people or names cannot occupy the starters and bench simultaneously.
  A new Major requires all five starters. Roster changes are locked during play.

## Bench duration

At the end of a Major, the substitute's consecutive bench counter increases. A
player remains on the bench after the first Major and leaves automatically after
the second. Their departure is reported even if they do not qualify for history.

Only completing a Major as a starter resets this counter. Swapping, promoting or
spending another token between Majors cannot reset it. A promoted starter can
leave in the normal performance departure draw.

## Performance departures

At the start of a single-player Major, the squad's average attributes are compared
with the fifteen selected opponents. Expected ranking sets an objective:
champion, finalist, semifinal, quarterfinal or Swiss stage. Legacy players use
their legacy attributes/rating; v2 players use their five editorial scores.

On completion the result is compared against that frozen objective:

| Performance | 0 departures | 1 | 2 | 3 |
| --- | ---: | ---: | ---: | ---: |
| Exceeded objective | 85% | 15% | 0% | 0% |
| Met objective | 65% | 30% | 5% | 0% |
| One placement tier below | 40% | 40% | 17% | 3% |
| Two or more tiers below | 20% | 45% | 25% | 10% |

The number is drawn first, then eligible starters are selected uniformly. The
designated star is always excluded from departures, regardless of performance.
The substitute is also exempt from this draw,
but can separately expire, so there may be three starter departures plus a bench
departure. Organization ID and Major ID seed the result: refreshing cannot reroll
departures. The history ID makes completion idempotent.

Single-player results settle as soon as the Major reaches its final result.
Multiplayer results settle locally from confirmed room snapshots when the member
is eliminated or the final ends, filtering other members' matches out of their
record. Abandoning a multiplayer Major does not award a completion token. Roster
changes remain locked while participating in the room's active Major. The room
must be left before starting a single-player Major.

## History and saves

Only the five former players with the most completed series for this organization
are retained. A BO3 counts as one match; forfeits do not add player matches. Ties
keep the existing historical entries. Players with zero matches do not qualify.
Returning players recover their match count if still in this bounded history;
discarded entries cannot recover previous counts without a separate ledger.

Career saves keep version 1 and add `organization.rosterVersion: 1`, optional
bench, token, historical player, notice and revision fields. Compact starter arrays
can contain two to five players between Majors; simulation snapshots and room
readiness still require five. Roles follow surviving players when indices shift;
a departed role holder defaults to the first remaining starter and is editable.

Before upgrading an existing career, its original JSON is retained under
`major-mvp:career:v1:before-roster-v1`. Roster actions save before updating the UI;
storage failures preserve the previous lineup. Data remains local to the browser:
there is no new cloud collection or change to Firestore rules.
