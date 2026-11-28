export type DfsLiveFixture = {
  id: number;
  providerId: string;
  status:
    | "SCHEDULED"
    | "LIVE"
    | "CONCLUDED"
    | "DORMANT"
    | string;

  homeTeam: string;
  awayTeam: string;

  homeScore: number | null;
  awayScore: number | null;

  venue: string;
  progress: number;
  timeRemaining: string;
};

export type DfsLivePlayer = {
  championDataId: string;
  fixtureId: number;

  playerName: string;
  team: string;
  homeAway: "home" | "away";

  superCoachPoints: number;
  dreamTeamPoints: number;

  quarterScores: {
    q1: number;
    q2: number;
    q3: number;
    q4: number;
  };

  timeOnGroundPercentage: number;

  // True only when the raw record had a timeOnGroundPercentage key.
  // When false, timeOnGroundPercentage is a 0 placeholder.
  timeOnGroundKnown: boolean;

  position: string;
  jumperNumber: number;

  benchReason: string | null;
  onBench: boolean;

  // True only when the raw record had an onBench key. When false,
  // onBench is a false placeholder and says nothing about the player.
  onBenchKnown: boolean;
};

export type DfsLiveFeed = {
  updatedAt: string | null;
  status: string;

  fixtures: DfsLiveFixture[];
  players: DfsLivePlayer[];
};

export type RawDfsFixture = {
  id: number;
  providerId?: string;
  status?: string;

  homeTeam?: string;
  awayTeam?: string;

  homeScore?: number;
  awayScore?: number;

  venueAbbr?: string;
  progress?: number;
  timeRemaining?: string;
};

export type RawDfsPlayer = {
  playerId?: string;
  playerName?: string;

  id?: number;
  teamAbbr?: string;
  homeAway?: string;

  superCoachPoints?: number;
  dreamTeamPoints?: number;

  q1?: number;
  q2?: number;
  q3?: number;
  q4?: number;

  timeOnGroundPercentage?: number;

  position?: string;
  playerJumperNumber?: number;

  benchReason?: string;
  onBench?: number;
};

export type RawDfsFeed = {
  timeStamp?: string[];
  status?: string[];
  fixtures?: RawDfsFixture[];
  playerStats?: RawDfsPlayer[];
};

function hasKey(
  record: object,
  key: string,
): boolean {
  return Object.prototype.hasOwnProperty.call(
    record,
    key,
  );
}

function finiteNumber(
  value: unknown,
  fallback = 0,
): number {
  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : fallback;
}

export function normaliseDfsLiveFeed(
  raw: RawDfsFeed,
): DfsLiveFeed {
  const fixtures: DfsLiveFixture[] = (
    raw.fixtures ?? []
  )
    .filter(
      (fixture) =>
        Number.isFinite(fixture.id) &&
        fixture.id !== 404,
    )
    .map((fixture) => ({
      id: fixture.id,

      providerId:
        fixture.providerId ?? "",

      status:
        fixture.status ?? "UNKNOWN",

      homeTeam:
        fixture.homeTeam ?? "",

      awayTeam:
        fixture.awayTeam ?? "",

      homeScore:
        typeof fixture.homeScore === "number"
          ? fixture.homeScore
          : null,

      awayScore:
        typeof fixture.awayScore === "number"
          ? fixture.awayScore
          : null,

      venue:
        fixture.venueAbbr ?? "",

      progress:
        finiteNumber(fixture.progress),

      timeRemaining:
        fixture.timeRemaining ?? "",
    }));

  const fixtureIds = new Set(
    fixtures.map((fixture) => fixture.id),
  );

  const players: DfsLivePlayer[] = (
    raw.playerStats ?? []
  )
    .filter(
      (player) =>
        typeof player.playerId === "string" &&
        player.playerId.startsWith("CD_I") &&
        player.playerId !== "temp" &&
        player.id !== 404 &&
        typeof player.id === "number" &&
        fixtureIds.has(player.id),
    )
    .map((player) => ({
      championDataId:
        player.playerId as string,

      fixtureId:
        player.id as number,

      playerName:
        player.playerName ?? "Unknown",

      team:
        player.teamAbbr ?? "",

      homeAway:
        player.homeAway === "away"
          ? "away"
          : "home",

      superCoachPoints:
        finiteNumber(
          player.superCoachPoints,
        ),

      dreamTeamPoints:
        finiteNumber(
          player.dreamTeamPoints,
        ),

      quarterScores: {
        q1: finiteNumber(player.q1),
        q2: finiteNumber(player.q2),
        q3: finiteNumber(player.q3),
        q4: finiteNumber(player.q4),
      },

      timeOnGroundPercentage:
        finiteNumber(
          player.timeOnGroundPercentage,
        ),

      timeOnGroundKnown: hasKey(
        player,
        "timeOnGroundPercentage",
      ),

      position:
        player.position ?? "",

      jumperNumber:
        finiteNumber(
          player.playerJumperNumber,
        ),

      benchReason:
        player.benchReason ?? null,

      onBench:
        player.onBench === 1,

      onBenchKnown: hasKey(
        player,
        "onBench",
      ),
    }));

  return {
    updatedAt:
      raw.timeStamp?.[0] ?? null,

    status:
      raw.status?.[0] ?? "UNKNOWN",

    fixtures,
    players,
  };
}