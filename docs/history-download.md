# Past-season history (manual one-off)

Research data for player-versus-opponent matchups across seasons. It is
**not** part of the weekly update (`npm run update:weekly` never calls
these scripts) and nothing in the app reads it.

## Running it

```
npm run download:history -- 2025 --dry-run   # counts and first URLs, no requests
npm run download:history -- 2025             # the download (about 700 requests)
npm run build:history -- 2025                # builds the compact file
```

`--refresh` re-downloads players already saved. Players already saved are
skipped otherwise, so a stopped run can simply be re-run.

## Why it is public-only

It uses only the two public endpoints the project already relies on, with
no subscriber key or auth parameters of any kind:

1. `/{SEASON}/api/afl/classic/v1/players`: the season's player list (id,
   name, team, feed_id). Needed because SuperCoach ids change between
   seasons; players are linked by `feed_id` (Champion Data id).
2. `/{SEASON}/api/afl/classic/v1/players/{id}?embed=player_stats,player_match_stats,positions`:
   one player's rounds. Only players who link to a current player by
   feed_id are fetched (about 705 for 2025).

It is polite: the same User-Agent as the other downloaders, one request at
a time at least 250ms apart, up to 4 attempts with backoff on network
errors and server errors, and the whole run stops on any 401, 403 or 429
(it reports how far it got and works around nothing). The subscriber
`players-cf` feed is never called.

## Files

- `data/history/{SEASON}/players-list.json` and
  `data/history/{SEASON}/players/{id}.json`: raw responses. Gitignored;
  never commit them.
- `data/history/matchups-{SEASON}.json`: the compact file, committed.
  - `players`: the season's list, `{ id, name, team, feed_id }`.
  - `byFeedId`: for each downloaded player, `{ id, name, team, positions,
    rounds }`, where each round played is
    `[round, opponent, venue, score, minutes, games]` (see `roundFields`).
  - Team and positions are the player's season values (the per-round
    position field is a ranking, not a position). No per-match stats.

2025 records include minutes played but not time on ground or the
advanced stats that 2026 has.
