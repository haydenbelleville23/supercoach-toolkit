"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import LiveIndicator from "@/components/layout/LiveIndicator";
import PlayerSearchBar from "@/components/projector/PlayerSearchBar";
import PlayerStatChips from "@/components/projector/PlayerStatChips";
import WatchlistStar from "@/components/ui/WatchlistStar";
import { useWatchlist } from "@/lib/watchlist/useWatchlist";
import ProjectionModeControl from "@/components/projector/ProjectionModeControl";
import SeasonProjectionTable from "@/components/projector/SeasonProjectionTable";
import MatchupSwitch from "@/components/ui/MatchupSwitch";
import { useMatchupSetting } from "@/lib/fixtureDifficulty/useMatchupSetting";
import { useLiveRoundContext } from "@/lib/liveMatch/useLiveRoundContext";
import { buildPlayerRows, type ScoreEdits } from "@/lib/projector/buildPlayerRows";
import { calculateScaledProjectionRows as calculateProjectionRows } from "@/lib/projector/calculateScaledProjectionRows";
import { playerRepository } from "@/lib/repository/PlayerRepository";

import type { ProjectionMode } from "@/lib/projector/projectionModes";
import type { SeasonProjectionRow } from "@/types/projection";

const players = playerRepository.getAll();

/**
 * Opens the player named in ?player=ID (links from Cash Cows and Live
 * Scores), falling back to the first player. Keyed on the id so following
 * a link to another player starts fresh.
 */
export default function ProjectorToolFromUrl() {
  const requestedId = Number(useSearchParams().get("player"));

  const initialPlayerId =
    playerRepository.getById(requestedId)?.id ?? players[0].id;

  return (
    <ProjectorTool
      key={initialPlayerId}
      initialPlayerId={initialPlayerId}
    />
  );
}

function ProjectorTool({
  initialPlayerId,
}: {
  initialPlayerId: number;
}) {
  const watchlist = useWatchlist();
  const [selectedPlayerId, setSelectedPlayerId] =
    useState(initialPlayerId);

  const [projectionMode, setProjectionMode] =
    useState<ProjectionMode>("projected");

  const selectedPlayer =
    playerRepository.getById(selectedPlayerId) ??
    players[0];

  // "Matchup adjustment" (on by default, remembered in this browser).
  const [matchupOn, setMatchupOn] = useMatchupSetting();

  // Scores typed in (round -> score). They win in every mode, are marked
  // as edited, and are cleared by picking a mode or another player.
  const [edits, setEdits] = useState<ScoreEdits>({});

  const [seasonRows, setSeasonRows] = useState<
    SeasonProjectionRow[]
  >(() =>
    calculateProjectionRows(
      buildPlayerRows(selectedPlayer, "projected", {}, { matchup: matchupOn }),
      selectedPlayer,
    ),
  );

  // Rebuild when the switch changes (including the saved value loading);
  // edits are kept.
  const [rowsMatchup, setRowsMatchup] = useState(matchupOn);
  if (rowsMatchup !== matchupOn) {
    setRowsMatchup(matchupOn);
    setSeasonRows(
      calculateProjectionRows(
        buildPlayerRows(selectedPlayer, projectionMode, edits, { matchup: matchupOn }),
        selectedPlayer,
      ),
    );
  }

  // Next round's k updates from live scores as games finish; recalculate
  // the displayed prices whenever it changes.
  const { contexts, isLive } = useLiveRoundContext();

  const displayedRows = useMemo(
    () =>
      calculateProjectionRows(
        seasonRows,
        selectedPlayer,
        contexts,
      ),
    [seasonRows, selectedPlayer, contexts],
  );

  function handlePlayerChange(playerId: number) {
    const player =
      playerRepository.getById(playerId) ??
      players[0];

    const newRows = buildPlayerRows(
      player,
      projectionMode,
      {},
      { matchup: matchupOn },
    );

    setEdits({});
    setSelectedPlayerId(player.id);
    setSeasonRows(
      calculateProjectionRows(newRows, player),
    );
  }

  function handleProjectionModeChange(
    mode: ProjectionMode,
  ) {
    setProjectionMode(mode);
    // As before Custom was removed: a new mode refills every future round.
    setEdits({});

    setSeasonRows(
      calculateProjectionRows(
        buildPlayerRows(selectedPlayer, mode, {}, { matchup: matchupOn }),
        selectedPlayer,
      ),
    );
  }

  function updateSeasonScore(
    round: number,
    score: number | null,
  ) {
    // The mode stays as it is; the round is marked as edited.
    const nextEdits = { ...edits, [round]: score };
    setEdits(nextEdits);

    setSeasonRows(
      calculateProjectionRows(
        buildPlayerRows(selectedPlayer, projectionMode, nextEdits, { matchup: matchupOn }),
        selectedPlayer,
      ),
    );
  }

  return (
    <>
      {/* One bar: player search and projection mode. */}
      <div className="mt-3 flex items-center gap-2">
        <PlayerSearchBar
          players={players}
          selectedPlayer={selectedPlayer}
          onChange={handlePlayerChange}
        />

        <ProjectionModeControl
          value={projectionMode}
          onChange={handleProjectionModeChange}
        />

        {/* Beside the mode from sm up; on its own line on phones (below). */}
        <MatchupSwitch on={matchupOn} onChange={setMatchupOn} className="hidden sm:inline-flex" />
      </div>

      <MatchupSwitch on={matchupOn} onChange={setMatchupOn} className="mt-2 sm:hidden" />

      <div className="mt-2 flex items-start gap-2">
        <WatchlistStar
          playerId={selectedPlayer.id}
          playerName={selectedPlayer.name}
          watchlist={watchlist}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <PlayerStatChips player={selectedPlayer} />
        </div>
      </div>

      <div className="mt-3">
        {isLive && (
          <LiveIndicator className="mb-2" />
        )}

        <SeasonProjectionTable
          rows={displayedRows}
          startingPrice={selectedPlayer.price}
          onScoreChange={updateSeasonScore}
        />
      </div>
    </>
  );
}
