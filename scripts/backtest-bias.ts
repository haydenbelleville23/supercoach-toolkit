/**
 * RESEARCH ONLY. Does a bias correction for expensive players help?
 *
 *   node scripts/backtest-bias.ts
 *
 * Same walk-forward setup as scripts/backtest-projections.ts (origins
 * 5-17, choose on 5-11, test on 12-17, the planner's price path and the
 * player bootstrap, from scripts/backtest/common.ts). Baseline: the season
 * mean for non-rookies with games. Bands use the price published after
 * the origin round. Local data only; CSVs go to scripts/output/.
 */

import { existsSync } from "node:fs";
import * as nodeModule from "node:module";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = process.cwd();

type ResolveHook = (
  specifier: string,
  context: { parentURL?: string },
  next: (specifier: string, context: { parentURL?: string }) => unknown,
) => unknown;
const { registerHooks } = nodeModule as unknown as { registerHooks: (hooks: { resolve: ResolveHook }) => void };
registerHooks({
  resolve(specifier, context, nextResolve) {
    let target = specifier;
    if (target.startsWith("@/")) target = pathToFileURL(path.join(ROOT, target.slice(2))).href;
    const isLocal = target.startsWith(".") || target.startsWith("file:");
    if (isLocal && !path.extname(target) && context.parentURL) {
      const filePath = fileURLToPath(new URL(target, context.parentURL));
      for (const extension of [".ts", ".tsx"]) {
        if (existsSync(filePath + extension)) return nextResolve(pathToFileURL(filePath + extension).href, context);
      }
    }
    return nextResolve(target, context);
  },
});

const C = await import("./backtest/common");
const {
  ORIGINS, BOOTSTRAP_SAMPLES,
  mean, quantile,
  buildOrigin, scoreObs, priceObs, flat,
  segmentOf, segmentFor, seg,
  inSample, outSample, horizon, both, mae, pairedBootstrap,
  fmt, money, signedMoney, verdict, csv, writeCsvs,
  reportMethods, comparisons,
} = C;
type OriginContext = ReturnType<typeof C.buildOrigin>;
type PlayerState = NonNullable<ReturnType<OriginContext["states"]["get"]>>;
type Obs = ReturnType<typeof C.scoreObs>[number];
type Filter = ReturnType<typeof C.both>;
type Result = { score: Obs[]; price: Obs[] };

// ---------------------------------------------------------------------------
// Bands and groups
// ---------------------------------------------------------------------------

const BANDS = ["<$300k", "$300-450k", "$450-600k", ">$600k"] as const;
const biasBand = (price: number) =>
  price < 300_000 ? BANDS[0] : price <= 450_000 ? BANDS[1] : price <= 600_000 ? BANDS[2] : BANDS[3];
const veteran = (s: PlayerState) => !s.rookie && s.scores.length >= 1;
const pool: Filter = seg((s) => s.price > 450_000);
const bandFilter = (b: string): Filter => seg((s) => biasBand(s.price) === b);

/** Bootstrap over players of the mean signed error (projected minus actual). */
function biasInterval(obs: Obs[], f: Filter) {
  const per = new Map<number, { s: number; n: number }>();
  for (const o of obs.filter(f)) {
    const p = per.get(o.pid) ?? { s: 0, n: 0 };
    p.s += o.err;
    p.n += 1;
    per.set(o.pid, p);
  }
  const players = [...per.values()];
  if (players.length < 5) return { value: NaN, lo: NaN, hi: NaN, players: players.length, n: 0 };
  const total = players.reduce((t, p) => t + p.n, 0);
  const value = players.reduce((t, p) => t + p.s, 0) / total;
  let seed = 4242;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const draws: number[] = [];
  for (let b = 0; b < BOOTSTRAP_SAMPLES; b++) {
    let s = 0;
    let n = 0;
    for (let i = 0; i < players.length; i++) {
      const p = players[Math.floor(rand() * players.length)];
      s += p.s;
      n += p.n;
    }
    draws.push(s / n);
  }
  return { value, lo: quantile(draws, 0.025), hi: quantile(draws, 0.975), players: players.length, n: total };
}

// ---------------------------------------------------------------------------
// Pass 1: origins, baseline, and the league quantities each correction uses
// ---------------------------------------------------------------------------

const contexts: OriginContext[] = [];
/** origin:pid -> his season mean, the league average, and his group average. */
const context = new Map<string, { avg: number; league: number; group: number; groupN: number }>();
const base: Result = { score: [], price: [] };

console.log("Building origins 5-17...");
for (const origin of ORIGINS) {
  const ctx = buildOrigin(origin);
  contexts.push(ctx);
  const vets = [...ctx.states.values()].filter(veteran);
  const league = mean(vets.map((s) => mean(s.scores)));
  const groups = new Map<string, number[]>();
  for (const s of vets) {
    const key = `${s.position}:${biasBand(s.price)}`;
    groups.set(key, [...(groups.get(key) ?? []), mean(s.scores)]);
  }
  for (const s of ctx.states.values()) {
    segmentOf.set(`${origin}:${s.id}`, segmentFor(s));
    if (!veteran(s)) continue;
    const group = groups.get(`${s.position}:${biasBand(s.price)}`) ?? [];
    context.set(`${origin}:${s.id}`, { avg: mean(s.scores), league, group: mean(group), groupN: group.length });
  }
  const proj = flat(ctx, (s) => mean(s.scores), veteran);
  base.score.push(...scoreObs(ctx, proj));
  base.price.push(...priceObs(ctx, proj));
}

// ---------------------------------------------------------------------------
// 1. The bias, decomposed
// ---------------------------------------------------------------------------

console.log("\n=== 1. SEASON-MEAN BIAS (projected minus actual score), all origins 5-17 ===");
const printBias = (label: string, f: Filter, csvName = "bias_decomposition") => {
  const b = biasInterval(base.score, f);
  csv(csvName, { segment: label, n: b.n, players: b.players, bias: fmt(b.value, 2), lo: fmt(b.lo, 2), hi: fmt(b.hi, 2) });
  console.log(`  ${label.padEnd(22)} n=${String(b.n).padStart(5)} players=${String(b.players).padStart(4)}  bias ${fmt(b.value, 2)} [${fmt(b.lo, 2)}, ${fmt(b.hi, 2)}]`);
};
console.log("By price band (price after the origin round):");
for (const b of BANDS) printBias(b, bandFilter(b));
printBias("over $450k (pool)", pool);
console.log("By games played (pool):");
for (const [label, lo, hi] of [["1-5", 1, 5], ["6-10", 6, 10], ["11+", 11, 99]] as const) {
  printBias(`pool, ${label} games`, both(pool, seg((s) => s.gamesN >= lo && s.gamesN <= hi)));
}
console.log("By position (pool):");
for (const p of ["DEF", "MID", "RUC", "FWD"]) printBias(`pool, ${p}`, both(pool, seg((s) => s.position === p)));
console.log("By origin (pool):");
for (const o of ORIGINS) printBias(`pool, origin ${o}`, both(pool, (x) => x.origin === o), "bias_by_origin");
console.log("Recently hot vs not (pool):");
printBias("pool, recently hot", both(pool, seg((s) => s.hot)));
printBias("pool, not hot", both(pool, seg((s) => !s.hot)));

// Concentration: how much of the pool's total over-projection comes from a few players.
const perPlayer = new Map<number, number>();
for (const o of base.score.filter(pool)) perPlayer.set(o.pid, (perPlayer.get(o.pid) ?? 0) + o.err);
const totals = [...perPlayer.values()].sort((a, b) => b - a);
const total = totals.reduce((t, x) => t + x, 0);
const positive = totals.filter((x) => x > 0).length;
console.log(`\nConcentration (pool, all origins): ${perPlayer.size} players; ${positive} over-projected in total (${fmt((100 * positive) / perPlayer.size)}%). The 10 most over-projected account for ${fmt((100 * totals.slice(0, 10).reduce((t, x) => t + x, 0)) / total)}% of the net over-projection.`);
const originBiases = ORIGINS.map((o) => biasInterval(base.score, both(pool, (x) => x.origin === o)).value);
console.log(`Per-origin pool bias: positive at ${originBiases.filter((b) => b > 0).length} of ${ORIGINS.length} origins (range ${fmt(Math.min(...originBiases), 1)} to ${fmt(Math.max(...originBiases), 1)}).`);

// ---------------------------------------------------------------------------
// 2. Corrections (fitted on origins 5-11 only)
// ---------------------------------------------------------------------------

const fitObs = base.score.filter(inSample);
const ctxOf = (o: Obs) => context.get(`${o.origin}:${o.pid}`)!;

// a. Fixed reduction for each band above $450k = its in-sample bias.
const reduction = new Map<string, number>();
for (const b of [BANDS[2], BANDS[3]]) {
  reduction.set(b, mean(fitObs.filter(bandFilter(b)).map((o) => o.err)));
}

// c. Regression to the mean: projection = avg - beta x (avg - league average).
//    Least squares on in-sample errors: beta = sum(x * err) / sum(x^2).
const fitSlope = (gap: (o: Obs) => number) => {
  let sxe = 0;
  let sxx = 0;
  for (const o of fitObs) {
    const x = gap(o);
    sxe += x * o.err;
    sxx += x * x;
  }
  return sxx > 0 ? sxe / sxx : 0;
};
const gapBoth = (o: Obs) => ctxOf(o).avg - ctxOf(o).league;
const gapAbove = (o: Obs) => Math.max(0, gapBoth(o));
const betaBoth = fitSlope(gapBoth);
const betaAbove = fitSlope(gapAbove);

console.log("\n=== 2. CORRECTIONS (fitted on origins 5-11) ===");
console.log(`a. Reductions: $450-600k ${fmt(reduction.get(BANDS[2])!, 2)} pts, over $600k ${fmt(reduction.get(BANDS[3])!, 2)} pts (lower bands unchanged).`);
console.log(`c. Regression to the mean: slope ${fmt(betaBoth, 3)} (both directions), ${fmt(betaAbove, 3)} (above the league average only).`);

const K_GRID = [3, 5, 8, 12, 20];
const results = new Map<string, Result>();
const run = (name: string, value: (s: PlayerState, origin: number) => number) => {
  const r: Result = { score: [], price: [] };
  for (const ctx of contexts) {
    const proj = flat(ctx, (s) => value(s, ctx.origin), veteran);
    r.score.push(...scoreObs(ctx, proj));
    r.price.push(...priceObs(ctx, proj));
  }
  results.set(name, r);
};

const info = (s: PlayerState, origin: number) => context.get(`${origin}:${s.id}`)!;
run("a: band reduction", (s, o) => info(s, o).avg - (reduction.get(biasBand(s.price)) ?? 0));
for (const k of K_GRID) {
  run(`b: shrink to position x band mean, k=${k}`, (s, o) => {
    const c = info(s, o);
    const w = s.scores.length / (s.scores.length + k);
    return w * c.avg + (1 - w) * c.group;
  });
}
run("c: regression to the mean (both ways)", (s, o) => info(s, o).avg - betaBoth * (info(s, o).avg - info(s, o).league));
run("c: regression to the mean (above only)", (s, o) => info(s, o).avg - betaAbove * Math.max(0, info(s, o).avg - info(s, o).league));

const bestB = [...results.keys()]
  .filter((n) => n.startsWith("b:"))
  .sort((x, y) => mae(results.get(x)!.price, both(inSample, pool)).value - mae(results.get(y)!.price, both(inSample, pool)).value)[0];
console.log(`b. Chosen on 5-11 (pool price error): ${bestB}`);

// ---------------------------------------------------------------------------
// 3. Results versus the season mean
// ---------------------------------------------------------------------------

const segments: [string, Filter][] = [
  ...BANDS.map((b): [string, Filter] => [b, bandFilter(b)]),
  ["DEF", seg((s) => s.position === "DEF")],
  ["MID", seg((s) => s.position === "MID")],
  ["RUC", seg((s) => s.position === "RUC")],
  ["FWD", seg((s) => s.position === "FWD")],
];
const methods = [...results.entries()].map(([n, r]): [string, string, Result] => [n, n, r]);
console.log("\n=== 3. OUT-OF-SAMPLE (origins 12-17) vs SEASON MEAN ===");
reportMethods({ title: "All non-rookies with games", methods, baseline: base, population: () => true, segments, csvName: "corrections_all" });
reportMethods({ title: "Over-$450k pool", methods, baseline: base, population: pool, segments, csvName: "corrections_pool" });

console.log("\nScore bias out-of-sample (projected minus actual), by band [95%]:");
console.log(`  ${"method".padEnd(42)} ${BANDS.map((b) => b.padStart(20)).join("")}`);
for (const [name, r] of [["season mean", base] as [string, Result], ...results.entries()]) {
  const cells = BANDS.map((b) => {
    const x = biasInterval(r.score, both(outSample, bandFilter(b)));
    return `${fmt(x.value, 2)} [${fmt(x.lo, 1)},${fmt(x.hi, 1)}]`.padStart(20);
  });
  console.log(`  ${name.padEnd(42)} ${cells.join("")}`);
  BANDS.forEach((b) => {
    const x = biasInterval(r.score, both(outSample, bandFilter(b)));
    csv("bias_out_of_sample", { method: name, band: b, bias: fmt(x.value, 2), lo: fmt(x.lo, 2), hi: fmt(x.hi, 2), score_mae: fmt(mae(r.score, both(outSample, bandFilter(b))).value, 2) });
  });
}

// Lower bands: does the correction hurt players under $450k?
console.log("\nLower bands (under $450k), out-of-sample price error vs season mean:");
const lower: Filter = seg((s) => s.price <= 450_000);
for (const [name, r] of results) {
  const b = pairedBootstrap(r.price, base.price, both(outSample, lower));
  comparisons.count += 1;
  console.log(`  ${name.padEnd(42)} ${signedMoney(b.diff)} [${signedMoney(b.lo)}, ${signedMoney(b.hi)}] ${verdict(b)}`);
}

// ---------------------------------------------------------------------------
// 4. Effect on a plan: the typical over-$450k player at +3 rounds
// ---------------------------------------------------------------------------

console.log("\n=== 4. PLAN EFFECT: over-$450k players, price at +3 rounds, out-of-sample ===");
console.log("Signed error = projected minus actual price (positive = the plan expects more than he ends up worth).");
const plan = both(outSample, pool, horizon(3));
const planRow = (name: string, r: Result) => {
  const errs = r.price.filter(plan).map((o) => o.err);
  const signed = biasInterval(r.price, plan);
  const row = { method: name, n: errs.length, mean_signed: Math.round(signed.value), lo: Math.round(signed.lo), hi: Math.round(signed.hi), median_signed: Math.round(quantile(errs, 0.5)), mae: Math.round(mae(r.price, plan).value) };
  csv("plan_effect", row);
  console.log(`  ${name.padEnd(42)} n=${row.n}  mean signed ${signedMoney(signed.value)} [${signedMoney(signed.lo)}, ${signedMoney(signed.hi)}], median ${signedMoney(row.median_signed)}, MAE ${money(row.mae)}`);
};
planRow("season mean", base);
for (const [name, r] of results) planRow(name, r);

console.log(`\nInterval comparisons run: ${comparisons.count}. About 5% of 95% intervals exclude zero by chance (~${Math.round(comparisons.count * 0.05)}).`);
const count = await writeCsvs("backtest-bias");
console.log(`CSVs written to scripts/output/backtest-bias-*.csv (${count} files).`);
