# Player availability (injuries, suspensions, selection)

The site shows who is likely to play from a list you import by hand each
week. There's no scraping and no network request: you save or paste the
list, and a script turns it into `data/2026/availability.json`.

The SuperCoach public data has its own injury fields
(`injury_suspension_status`, `_text`). They were empty in every copy taken
so far (all captured after the season), so they're only a fallback, and
their values are logged so we can learn what they mean.

## Weekly process

1. **Early in the week** (after the injury list is published), copy the
   list into a CSV, or paste the table into a text file. Use one row per
   player.
2. Check it without writing anything:

   ```
   npm run import:availability -- --file lists/round-11.csv --dry-run
   ```

   The script:

   - prints the round the list applies to and a summary by status
   - shows what changed since the current file
   - lists every SuperCoach status value it saw
   - lists any row it couldn't match, with suggestions ("did you mean …?")

3. Fix any unmatched or ambiguous rows (usually the team, or the spelling),
   then run it again without `--dry-run`. If a row can't be fixed (for
   example a player not in our data), add `--allow-unmatched` to skip it.
4. **Optional, Thursday or Friday:** when teams are announced, add a
   `selected` column (yes/no) and import again. This turns on the Cash
   Cows "Selected" filter.
5. Review `git diff data/2026/availability.json` and commit. Never edit
   that file by hand.

It isn't part of `npm run update:weekly`.

### Options

| Flag | Meaning |
|---|---|
| `--file path` | The list (required). |
| `--asOf YYYY-MM-DD` | Date of the list. Default: today in Melbourne. Sets the round it applies to (the next round with a game on or after that date). |
| `--source "text"` | Where the list came from (shown in badge details). |
| `--dry-run` | Check and summarise; write nothing. |
| `--allow-unmatched` | Write even if some rows couldn't be matched (they're skipped). |

## Columns

Headers can be in any order and any case. The file can be comma-separated
(CSV), tab-separated (pasted from a web table) or pipe-separated. Lines
starting with `#` are ignored.

| Column | Required | Notes |
|---|---|---|
| `player` | yes | Full name. Case, accents and punctuation don't matter ("Davies Uniacke" = "Davies-Uniacke"). |
| `team` | yes (can be blank) | Code (`GWS`), name (`Adelaide`) or nickname (`Crows`). Needed to tell apart two players with the same name. |
| `injury` | yes (can be blank) | "Hamstring", "Suspension", … |
| `estimated return` | yes (can be blank) | "Test", "1-2 weeks", "4-6 weeks", "Season", "TBC", "2 matches". |
| `selected` | no | `yes`, `no` or blank (not known). |
| `status` | no | Override: `available`, `test`, `short-term`, `long-term`, `suspended` or `unknown`. |

### Example (invented rows)

```csv
player,team,injury,estimated return,selected,status
Alex Example,ADE,Hamstring,1-2 weeks,,
Sam Sample,Crows,Knee,Season,,
Jo Placeholder,GWS,Suspension,2 matches,,
Lee Dummy,North Melbourne,Concussion,Test,yes,
Pat Testcase,COL,Back,TBC,,
Chris Notreal,SYD,,,yes,
```

## How rows are classified

The rules and thresholds live in `lib/availability/config.ts`.

| Estimated return | Status | Badge |
|---|---|---|
| "Test" | test | TEST |
| 1-3 weeks (upper end of a range) | short-term | OUT 2w |
| 4+ weeks, "Season", "Indefinite" | long-term | INJ |
| "Suspension"/"Suspended" in injury or return | suspended (with its weeks) | SUS |
| "TBC", or anything that isn't a number | unknown (never counted as out) | ? |
| Blank injury and blank return | available (e.g. a selection-only row) | none |

- **Return round:** the round the list applies to plus the weeks, with
  weeks counted as rounds (byes aren't allowed for).
- **From the return round on**, a player counts as available.
- **Long-term with no number** (Season, Indefinite) is out for every later
  round.
- **A test** applies to the list's round only.
- **Players not on a loaded list** are available. With no list at all,
  nothing is shown and everyone counts as playing.

## Where it shows

- **Badges:** on Trade Planner field cards (top-right corner), My Team
  squad rows, Cash Cows rows and the Projector. They're greyed when the
  list is more than 7 days old.
- **Cash Cows filter:** All / Available / Selected.
- **Trade Planner setting:** "Count long-term injured and suspended players
  as not playing" (on by default). It changes the playing counts, "Total
  playing X/23" and the 18-player bye warning only. Prices and projections
  are unaffected.

## Debug lock (`DEBUG_AS_OF_ROUND`)

Availability is a live snapshot and can't be time-travelled. With the lock
on, the real file is ignored and `data/2026/availability.fixture.json` is
loaded instead. That file is a small invented sample, labelled "Sample
status data" wherever badges appear. A normal build never includes or
reads it (`lib/availability/alias.ts`, `next.config.ts`).

## Credit

When you choose a source, set `AVAILABILITY_SOURCE_LABEL` in
`lib/availability/config.ts`. The footer then shows "Injury information:
{label}". Check that source's terms before relying on it, and pass the
same text as `--source`.
