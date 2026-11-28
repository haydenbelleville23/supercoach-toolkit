# Starting a new season (2027)

The site shows one season at a time. Adding next season's data changes
nothing on the live site until you switch it.

## The switch

- `ACTIVE_SEASON` in `lib/season/seasonYear.ts` is the committed setting
  (2026). Change it to 2027 when you want the live site to show 2027.
- `DEBUG_SEASON=2027` shows 2027 locally without changing anything:
  `npm run dev:2027`. Like `DEBUG_AS_OF_ROUND`, it is only ever an
  environment variable (never in a committed file, `next.config.ts` or
  Vercel), so production ignores it. The two can't be combined.
- The season's **phase** is derived from the data:
  - `preseason`: no round completed yet;
  - `inseason`: at least one round completed;
  - `complete`: the last fixtured round is completed.

## What a preseason looks like

- **Fixture Difficulty** works. Opponent difficulty comes from last
  season's final data, applied to the new fixtures, labelled "Based on 2026
  results; updates as 2027 scores arrive". Every round is shown from Round 0,
  with byes, Rest and Next 5. Without last season's data, the fixtures are
  shown without values, and the page says so.
- **Home page**: a banner says the fixtures are in and that prices and
  players open when AFL SuperCoach launches. The tiles stay.
- **Projector, Cash Cows, Trade Planner, My Team and Live Scores** show a
  notice linking to Fixture Difficulty, instead of last season's prices.
- **Results** opens on the latest season with completed games (last
  season), and the season switcher stays.
- **Saved teams and plans are per season.** 2026 keeps its saved team under
  the key it always had. 2027 starts empty, and nothing is migrated. A
  "start from your 2026 team" option would be a later feature.

## Getting the fixtures (three routes)

No route runs on its own: you choose and run one.

### 1. Import a CSV

```
npm run import:fixtures -- --season 2027 --file path/to/fixtures-2027.csv
```

Columns (header row required):

| Column | Example | Notes |
| --- | --- | --- |
| round | 1 | 0 to 24 |
| home | COL | Our three-letter code or a known name ("Magpies", "GWS Giants") |
| away | Carlton | As above |
| venue | MCG | |
| kickoff | 2027-03-11T19:30:00+11:00 | ISO 8601 **with an offset** (+11:00 daylight saving, +10:00 after) |
| notes | | Optional |

The importer prints a report: rounds, games per round, games per team, and
byes per round and per team (a bye is a team with no game that round). It
doesn't guess, and nothing is written when there are:

- **Errors**: unknown teams, a team playing itself, a duplicate game, a team
  with two games in a round, bad or offset-less kickoffs, or rounds outside
  0 to 24.
- **Warnings**, unless you pass `--allow-warnings`: teams with different
  game counts, rounds with no games, or a game with no venue.

It writes `data/2027/fixtures-raw.json` in the same shape as the downloaded
file, so every page reads it unchanged. An existing file is only replaced
with `--force`. `--dry-run` reports without writing.

**The source of any CSV you supply is your responsibility.** Use a fixture
you're allowed to use, and check the report against it.

### 2. Download from AFL SuperCoach (public endpoint)

```
npm run download:fixtures -- --season 2027 --dry-run   # list the URLs, no requests
npm run download:fixtures -- --season 2027
```

One public request per round (no login), with the same polite delay as
before. It stops at once on HTTP 401, 403 or 429, writes nothing, and must
not be retried or worked around. A round the endpoint returns no games for
is reported by round number. If no round has games, nothing is written
(the fixture probably isn't released yet). The season defaults to the one
the site shows.

### 3. The invented sample (local testing only)

```
npm run generate:sample-fixtures   # writes data/2027/fixtures.sample.json
npm run dev:2027
```

The sample is made up: Rounds 0 to 24, an Opening Round, byes in Rounds 2
to 4 and 12 to 16, and two byes per team. It is checked with the importer's
validation before it's written. It's only loaded with `DEBUG_SEASON=2027`
and no real `data/2027/fixtures-raw.json`, and it's labelled "Sample
fixtures (invented, for testing)" wherever fixtures are shown. It never
loads in production; a test checks this.

## Going live with 2027

1. Get the real fixtures (route 1 or 2) and commit `data/2027/fixtures-raw.json`.
2. Check the preseason locally with `npm run dev:2027`.
3. Change `ACTIVE_SEASON` to 2027 and deploy.
4. When AFL SuperCoach launches, download players for 2027 as usual. The
   pages that show the preseason notice open once rounds start completing.
