# SuperCoach data: history and current sources

This page records how the project's data sources changed. It is not a
guide to accessing any subscriber-only data.

## Current sources (public only)

| Data | Source | Used by |
|---|---|---|
| Player identity, team, positions, availability | Public per-player SuperCoach endpoint (`/players/{id}`) | `scripts/downloadPlayerDetails.mjs` |
| Round-by-round prices, price changes, scores, games | The same per-player endpoint | `scripts/buildPlayersDataset.mjs` |
| Fixtures and results | Public SuperCoach fixture endpoint (`/real_fixture`) | `scripts/downloadFixtures.mjs` |
| Live scores | DFS Australia live feed | `app/api/live-scores/route.ts` |

Derived by this project, not taken from SuperCoach:

- Current price, games and averages: rebuilt from each player's public
  history (`lib/supercoach/publicPlayerState.ts`).
- Breakevens and projected prices: our scaled price engine.
- Projected scores: the season average (`lib/planner/projectScore.ts`).

Not available yet:

- **Ownership.** No source is wired in; the field is null and hidden in the
  UI.
- **New players.** There is no public list of players. The player list is
  the set of ids already saved in `data/2026/player-details/`; ids are
  never guessed or enumerated.

## History

Early in development (July 2026) the project tried a SuperCoach player-list
endpoint that is tied to a subscription. Its data included subscriber-only
fields: SuperCoach's own breakevens, projected scores, projected prices
and price changes, and ownership. A one-off copy was used to build the
first datasets.

That was replaced in November 2026. The subscriber data and the captured
file were removed from the working tree and the build. Nothing in the
project reads, downloads or needs subscriber data, and it must not be
added back. Older commits still contain the removed files.
