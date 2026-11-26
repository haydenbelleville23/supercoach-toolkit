// Resolved by next.config.ts (and vitest.config.ts) to the availability
// file, the debug sample or the no-data stub. See lib/availability/alias.ts.
declare module "availability-snapshot" {
  const data: unknown;
  export default data;
}
