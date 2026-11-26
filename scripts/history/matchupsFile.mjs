/**
 * Builds the compact per-season matchup file (data/history/matchups-{SEASON}.json)
 * from the public players list and per-player records. Shared by
 * scripts/buildHistory.mjs (past seasons) and the matchup backtest (which
 * builds 2026 the same way from data/2026/player-details).
 *
 * Kept small: one row per round played, no per-match stats.
 */

/** Row layout for each round played. */
export const ROUND_FIELDS = ["round", "opponent", "venue", "score", "minutes", "games"];

/** Champion Data id as a plain string ("1022607"), whatever the source format. */
export function normaliseFeedId(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return String(value).replace(/^CD_I/, "");
}

/** A list entry from the raw players list, or the reduced form {id, name, team, feed_id}. */
export function listEntry(raw) {
  return {
    id: raw.id,
    name: raw.name ?? `${raw.first_name ?? ""} ${raw.last_name ?? ""}`.trim(),
    team: typeof raw.team === "string" ? raw.team : raw.team?.abbrev ?? null,
    feed_id: normaliseFeedId(raw.feed_id),
  };
}

/** One player's rounds played, from a per-player record's player_stats. */
export function roundsPlayed(record) {
  return (record.player_stats ?? [])
    .filter((row) => Number(row.games ?? 0) > 0 && row.points !== null && row.points !== undefined)
    .sort((a, b) => a.round - b.round)
    .map((row) => [
      row.round,
      row.opp?.abbrev ?? null,
      row.ven?.abbrev ?? null,
      Number(row.points),
      row.minutes_played === null || row.minutes_played === undefined ? null : Number(row.minutes_played),
      Number(row.games),
    ]);
}

/**
 * The compact file: the season's player list (id, name, team, feed_id) and,
 * keyed by feed_id, each linked player's team, positions and rounds played.
 */
export function buildMatchupsFile({ season, list, records, source }) {
  const players = list.map(listEntry);
  const byFeedId = {};

  for (const record of records) {
    const feedId = normaliseFeedId(record.feed_id);

    if (!feedId) {
      continue;
    }

    byFeedId[feedId] = {
      id: record.id,
      name: `${record.first_name ?? ""} ${record.last_name ?? ""}`.trim(),
      team: record.team?.abbrev ?? null,
      positions: (record.positions ?? []).map((p) => p.position),
      rounds: roundsPlayed(record),
    };
  }

  return {
    season,
    source,
    generatedAt: new Date().toISOString(),
    roundFields: ROUND_FIELDS,
    players,
    byFeedId,
  };
}
