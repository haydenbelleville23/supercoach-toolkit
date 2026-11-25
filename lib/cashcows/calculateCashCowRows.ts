import { CURRENT_COMPLETED_ROUND } from "@/data/season";

import {
  buildPlayerRows,
  calculateScaledProjectionRows,
} from "@/lib/projector";

import type { ProjectionMode } from "@/lib/projector";
import type { Player } from "@/types/player";
import type { SeasonProjectionRow } from "@/types/projection";

import type {
  CashCowProjectedRound,
  CashCowRow,
  CashCowScoreOverrides,
} from "./types";

function applyScoreOverrides(
  rows: SeasonProjectionRow[],
  playerId: number,
  scoreOverrides: CashCowScoreOverrides,
): SeasonProjectionRow[] {
  const playerOverrides =
    scoreOverrides[playerId];

  if (!playerOverrides) {
    return rows;
  }

  return rows.map((row) => {
    if (
      row.round <= CURRENT_COMPLETED_ROUND
    ) {
      return row;
    }

    const overriddenScore =
      playerOverrides[row.round];

    if (overriddenScore === undefined) {
      return row;
    }

    return {
      ...row,
      score: overriddenScore,
      played: true,
      isActual: false,
    };
  });
}

function getProjectedRounds(
  calculatedRows: SeasonProjectionRow[],
): CashCowProjectedRound[] {
  return calculatedRows
    .filter(
      (row) =>
        row.round > CURRENT_COMPLETED_ROUND &&
        row.score !== null &&
        row.price !== null &&
        Number.isFinite(row.score) &&
        Number.isFinite(row.price),
    )
    .map((row) => ({
      round: row.round,
      score: row.score as number,
      price: row.price as number,
      priceChange: row.priceChange,
    }));
}

function getProjectedAverage(
  projectedRounds: CashCowProjectedRound[],
): number {
  if (projectedRounds.length === 0) {
    return 0;
  }

  const totalScore = projectedRounds.reduce(
    (total, round) =>
      total + round.score,
    0,
  );

  return Math.round(
    totalScore / projectedRounds.length,
  );
}

function getGainAfterRounds(
  projectedRounds: CashCowProjectedRound[],
  currentPrice: number,
  numberOfRounds: number,
): number | null {
  const targetRound =
    CURRENT_COMPLETED_ROUND +
    numberOfRounds;

  const projectedRound =
    projectedRounds.find(
      (round) =>
        round.round === targetRound,
    );

  if (!projectedRound) {
    return null;
  }

  return projectedRound.price - currentPrice;
}

export function calculateCashCowRow(
  player: Player,
  mode: ProjectionMode,
  scoreOverrides: CashCowScoreOverrides = {},
): CashCowRow | null {
  if (
    player.recentScores.length < 2 ||
    !Number.isFinite(player.price)
  ) {
    return null;
  }

  const baseRows = buildPlayerRows(
    player,
    mode,
  );

  const rowsWithOverrides =
    applyScoreOverrides(
      baseRows,
      player.id,
      scoreOverrides,
    );

  const calculatedRows =
    calculateScaledProjectionRows(
      rowsWithOverrides,
      player,
    );

  const projectedRounds =
    getProjectedRounds(calculatedRows);

  if (projectedRounds.length === 0) {
    return null;
  }

  const toppedOutRound =
  findToppedOutRound(projectedRounds);

  return {
    player,

    projectedAverage:
      getProjectedAverage(
        projectedRounds,
      ),

    toppedOutPrice: toppedOutRound.price,

    toppedOutGain:
        toppedOutRound.price - player.price,

    toppedOutRound:
        toppedOutRound.round,

    rise1: getGainAfterRounds(
      projectedRounds,
      player.price,
      1,
    ),

    rise3: getGainAfterRounds(
      projectedRounds,
      player.price,
      3,
    ),

    rise5: getGainAfterRounds(
      projectedRounds,
      player.price,
      5,
    ),

    projectedRounds,
  };
}

function findToppedOutRound(
  projectedRounds: CashCowProjectedRound[],
): CashCowProjectedRound {
  const TOPPED_OUT_THRESHOLD = 10_000;
  const LOOKAHEAD_ROUNDS = 3;

  for (
    let index = 0;
    index < projectedRounds.length;
    index += 1
  ) {
    const currentRound = projectedRounds[index];

    const lookaheadIndex = Math.min(
      index + LOOKAHEAD_ROUNDS,
      projectedRounds.length - 1,
    );

    const futureRound =
      projectedRounds[lookaheadIndex];

    const futureGain =
      futureRound.price - currentRound.price;

    if (futureGain < TOPPED_OUT_THRESHOLD) {
      return currentRound;
    }
  }

  return projectedRounds[
    projectedRounds.length - 1
  ];
}

export function calculateCashCowRows(
  players: Player[],
  mode: ProjectionMode,
  scoreOverrides: CashCowScoreOverrides = {},
): CashCowRow[] {
  return players
    .map((player) =>
      calculateCashCowRow(
        player,
        mode,
        scoreOverrides,
      ),
    )
    .filter(
      (row): row is CashCowRow =>
        row !== null,
    );
}