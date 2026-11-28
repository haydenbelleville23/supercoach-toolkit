// Resolved by next.config.ts (and vitest.config.ts) to the invented sample
// live feed (debug lock only) or a no-data stub. See lib/liveMatch/sampleAlias.ts.
declare module "live-sample-feed" {
  const data: unknown;
  export default data;
}
