export function buildProjectionRows(
    player: Player,
    rows: SeasonProjectionRow[],
): SeasonProjectionRow[] {

    const state = createPlayerState(player);

    const projectedScores = ...

    const projections = projectSeason(
        state,
        projectedScores,
    );

    ...
}