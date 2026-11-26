import type { GamePlayer } from "./types";

const sum = (players: readonly GamePlayer[], key: keyof GamePlayer) =>
  players.reduce((total, p) => total + (typeof p[key] === "number" ? (p[key] as number) : 0), 0);

/** Whether any player in the game has time-on-ground data. */
export function hasTogData(players: readonly GamePlayer[]): boolean {
  return players.some((p) => p.tog !== null);
}

/** Team totals (not SC): disposals, kicks, handballs, marks, tackles, hitouts, goals. Missing stats count as 0. */
export function teamTotals(players: readonly GamePlayer[]) {
  return {
    disposals: sum(players, "disposals"),
    kicks: sum(players, "kicks"),
    handballs: sum(players, "handballs"),
    marks: sum(players, "marks"),
    tackles: sum(players, "tackles"),
    hitouts: sum(players, "hitouts"),
    goals: sum(players, "goals"),
  };
}
