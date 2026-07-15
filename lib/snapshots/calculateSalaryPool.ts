export type SalaryPoolPolicy =
  | "fixed-from-launch"
  | "fixed-from-r0"
  | "expand-with-new-players";

export function calculateTargetSalaryPool({
  launchPool,
  roundZeroPool,
  previousTargetPool,
  addedPlayerSalary,
  policy,
}: {
  launchPool: number;
  roundZeroPool: number;
  previousTargetPool: number;
  addedPlayerSalary: number;
  policy: SalaryPoolPolicy;
}): number {
  switch (policy) {
    case "fixed-from-launch":
      return launchPool;

    case "fixed-from-r0":
      return roundZeroPool;

    case "expand-with-new-players":
      return previousTargetPool + addedPlayerSalary;
  }
}