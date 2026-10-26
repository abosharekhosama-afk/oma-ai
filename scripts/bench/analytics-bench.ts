/**
 * Analytics query benchmark. Usage (against a seeded, throwaway DB only):
 *   DATABASE_URL=postgresql://…/oma_bench pnpm tsx scripts/bench/analytics-bench.ts
 */
import { analyticsService } from '../../apps/api/src/analytics/analytics.service';

const RUNS = Number(process.env.BENCH_RUNS ?? 9);
async function time(label: string, fn: () => Promise<unknown>) {
  await fn(); // warm-up
  const ms: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const t = performance.now();
    await fn();
    ms.push(performance.now() - t);
  }
  ms.sort((a, b) => a - b);
  console.log(`${label.padEnd(36)} median ${ms[Math.floor(ms.length / 2)]!.toFixed(1)}ms  p90 ${ms[Math.floor(ms.length * 0.9)]!.toFixed(1)}ms`);
}
async function main() {
const tenant = process.env.BENCH_TENANT ?? 't1';
const brand = process.env.BENCH_BRAND ?? 'b1_1';
await time('overview 30d (tenant)', () => analyticsService.overview(tenant, { period: '30' }));
await time('content overview 30d (tenant)', () => analyticsService.contentOverview(tenant, { period: '30' }));
await time('content overview 90d (tenant)', () => analyticsService.contentOverview(tenant, { period: '90' }));
await time('content overview 30d (brand)', () => analyticsService.contentOverview(tenant, { period: '30', brandId: brand }));
}
void main().then(() => process.exit(0));
