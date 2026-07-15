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