# SuperCoach Data Investigation

## Goal

Determine whether AFL SuperCoach player data can be accessed directly and reliably.

## Required Fields

- Player ID
- Player name
- Team
- Position
- Current price
- Break-even
- Season average
- Round scores
- Price history
- Availability or injury status

## Preferred Source

The official SuperCoach website.

## Questions

- Does the website use a JSON API?
- Is authentication required?
- Which endpoints provide player data?
- Are break-evens included?
- Are historical scores included?
- How often does the data update?
- Can the data be used reliably for a public website?

## Findings

To be completed.
### Players CF endpoint

A `players-cf` request returned player data successfully when the plain
`players` endpoint returned a blank response when opened directly.

This may indicate:

- a cached or proxied endpoint,
- additional browser/session requirements,
- or a Cloudflare-specific delivery path.
## Confirmed Players-CF Endpoint

Endpoint:

`/2026/api/afl/classic/v1/players-cf`

Observed parameters:

- embed
- round
- xredir
- subid
- subkey

Do not record real subid or subkey values in the repository.

## Confirmed Player Fields

### Identity

- id
- first_name
- last_name
- team
- positions
- active
- injury_suspension_status
- played_status

### Current Performance

- points
- total_points
- games
- total_games
- avg
- avg3
- avg5
- std

### Price Data

- price
- price_change
- total_price_change
- be1
- be2
- be3
- pp1
- pp2
- pp3
- ppc1
- ppc2
- ppc3
- ppcs

### Projections

- ppts
- ppts1
- ppts2
- ppts3
- pmin
- pmax
- prange

### Ownership

- own
- own_raw
- owned
- ownc
- ownc3
- capt
- vice

### Fixture Data

- opp
- opp1
- opp2
- opp3
- ven
- ven1
- ven2
- ven3
- opposition rankings

## Key Finding

The endpoint contains nearly all data required for the Price Projector,
Cash Cow Finder, Break-even Tracker, Player Profiles and Fixture Analysis.

Access appears linked to subscription parameters. Legal permission,
terms of use and technical access constraints must be investigated before
using it in a public application.