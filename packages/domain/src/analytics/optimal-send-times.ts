/**
 * Optimal send-time scoring: 7x24 weekday-hour buckets, recency decay,
 * Bayesian shrinkage toward network/timezone priors, and spaced top-N picks.
 * dayOfWeek is 0 = Sunday ... 6 = Saturday (same convention as WorkspaceTimeSlot).
 */

export const OPTIMAL_TIMES_WINDOW_DAYS = 16 * 7;
export const OPTIMAL_TIMES_HALF_LIFE_DAYS = 28;
export const OPTIMAL_TIMES_KAPPA = 8;
export const OPTIMAL_TIMES_MIN_SAMPLES = 20;
export const OPTIMAL_TIMES_TOP_N = 7;
export const OPTIMAL_TIMES_MIN_GAP_HOURS = 2;
export const OPTIMAL_TIMES_OUTLIER_SIGMA = 4;

export type OptimalTimesStatus = 'ready' | 'low_data' | 'no_data';
export type OptimalTimesSource = 'model' | 'prior';

export type ParsedPostInsights = {
  impressions?: number;
  reach?: number;
  likes?: number;
  comments?: number;
  views?: number;
  shares?: number;
  fetchedAt?: string;
};

export type SnapshotMetrics = {
  impressions: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  views: number | null;
  engagementRate: number | null;
  engagements: number;
};

export type OptimalSnapshotInput = {
  publishedAt: Date;
  impressions?: number | null;
  reach?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  views?: number | null;
  engagementRate?: number | null;
  excluded?: boolean;
};

export type HeatmapCell = {
  day_of_week: number;
  hour_local: number;
  score: number;
  n: number;
  confidence: number;
  weighted_er: number;
  engagement_sum: number;
};

export type RankedSlot = {
  day_of_week: number;
  hour_local: number;
  minute_of_day: number;
  rank: number;
  score: number;
  confidence: number;
  n: number;
  source: OptimalTimesSource;
  label: 'high' | 'medium' | 'low';
};

export type PageOptimalTimes = {
  status: OptimalTimesStatus;
  sample_size: number;
  timezone: string;
  network: string;
  cells: HeatmapCell[];
  slots: RankedSlot[];
};

function num(n: unknown): number | undefined {
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
}

export function parsePostInsights(raw: string | null | undefined): ParsedPostInsights | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    return {
      impressions: num(v.impressions),
      reach: num(v.reach),
      likes: num(v.likes),
      comments: num(v.comments),
      shares: num(v.shares),
      views: num(v.views),
      fetchedAt: typeof v.fetchedAt === 'string' ? v.fetchedAt : undefined,
    };
  } catch {
    return null;
  }
}

export function snapshotMetricsFromInsights(insights: ParsedPostInsights): SnapshotMetrics {
  const likes = insights.likes ?? null;
  const comments = insights.comments ?? null;
  const shares = insights.shares ?? null;
  const impressions = insights.impressions ?? null;
  const reach = insights.reach ?? null;
  const views = insights.views ?? null;
  const engagements = (likes ?? 0) + (comments ?? 0) + (shares ?? 0);
  return {
    impressions,
    reach,
    likes,
    comments,
    shares,
    views,
    engagements,
    engagementRate: engagementRate({ likes, comments, shares, reach, impressions }),
  };
}

/** Equation (1). Missing reach and impressions (e.g. LinkedIn) -> null. */
export function engagementRate(input: {
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  reach?: number | null;
  impressions?: number | null;
}): number | null {
  const likes = input.likes ?? 0;
  const comments = input.comments ?? 0;
  const shares = input.shares ?? 0;
  const hasDenom =
    (typeof input.reach === 'number' && Number.isFinite(input.reach)) ||
    (typeof input.impressions === 'number' && Number.isFinite(input.impressions));
  if (!hasDenom) return null;
  const denom = Math.max(input.reach ?? 0, input.impressions ?? 0, 1);
  return (likes + comments + shares) / denom;
}

/** Equation (2): exponential recency with a 4-week half-life. */
export function recencyWeight(
  ageDays: number,
  halfLifeDays = OPTIMAL_TIMES_HALF_LIFE_DAYS,
): number {
  if (!Number.isFinite(ageDays) || ageDays < 0) return 1;
  return 2 ** (-ageDays / halfLifeDays);
}

/** Equation (3): shrink the cell mean toward a prior. */
export function shrinkScore(
  n: number,
  mean: number,
  prior: number,
  kappa = OPTIMAL_TIMES_KAPPA,
): number {
  const nn = Math.max(0, n);
  const k = Math.max(0, kappa);
  if (nn + k === 0) return prior;
  return (nn * mean + k * prior) / (nn + k);
}

export function confidenceFromSamples(n: number, kappa = OPTIMAL_TIMES_KAPPA): number {
  const nn = Math.max(0, n);
  const k = Math.max(0, kappa);
  if (nn + k === 0) return 0;
  return nn / (nn + k);
}

export function confidenceLabel(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= 0.6) return 'high';
  if (confidence >= 0.3) return 'medium';
  return 'low';
}

export function optimalTimesStatus(sampleSize: number): OptimalTimesStatus {
  if (sampleSize <= 0) return 'no_data';
  if (sampleSize < OPTIMAL_TIMES_MIN_SAMPLES) return 'low_data';
  return 'ready';
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();

function zonedFmt(tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

export function isUsableTimezone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    zonedFmt(tz);
    return true;
  } catch {
    return false;
  }
}

/** Local Sunday=0 weekday and hour of an instant in `tz`. */
export function localWeekdayHour(
  instant: Date,
  tz: string,
): { dayOfWeek: number; hourLocal: number; dayKey: string } {
  const parts: Record<string, number> = {};
  for (const x of zonedFmt(tz).formatToParts(instant)) {
    if (x.type !== 'literal') parts[x.type] = Number(x.value);
  }
  const year = parts.year ?? 1970;
  const month = parts.month ?? 1;
  const day = parts.day ?? 1;
  const hourLocal = parts.hour ?? 0;
  const dayKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const dayOfWeek = new Date(`${dayKey}T00:00:00Z`).getUTCDay();
  return { dayOfWeek, hourLocal, dayKey };
}

export function ageInDays(publishedAt: Date, now: Date): number {
  return Math.max(0, (now.getTime() - publishedAt.getTime()) / 86_400_000);
}

/**
 * Manual industry priors (0-1) by network. Gulf-oriented peaks:
 * LinkedIn 09-11 (and lunch), Instagram/Facebook evenings 18-21, X late afternoon
 * + evening, TikTok midday + evening. Weekends are dampened for LinkedIn.
 */
export function industryPrior(
  network: string,
  dayOfWeek: number,
  hour: number,
  _timezone?: string,
): number {
  const n = network.trim().toLowerCase();
  const peakA = n === 'linkedin' ? 9 : n === 'tiktok' ? 12 : 10;
  const peakB = n === 'linkedin' ? 12 : n === 'x' ? 20 : 19;
  const eveW = n === 'linkedin' ? 0.45 : 1;
  const mornW = n === 'tiktok' ? 0.55 : n === 'linkedin' ? 1 : 0.7;
  const weekend = dayOfWeek === 5 || dayOfWeek === 6 ? (n === 'linkedin' ? -0.22 : 0.1) : 0;
  const morning = Math.exp(-((hour - peakA) * (hour - peakA)) / 8);
  const evening = Math.exp(-((hour - peakB) * (hour - peakB)) / 10);
  const raw = Math.max(0, morning * mornW + evening * eveW + weekend);
  return Math.min(1, raw / 1.15);
}

export function emptyGridFromPriors(network: string, timezone?: string): HeatmapCell[] {
  const cells: HeatmapCell[] = [];
  for (let d = 0; d < 7; d += 1) {
    for (let h = 0; h < 24; h += 1) {
      const prior = industryPrior(network, d, h, timezone);
      cells.push({
        day_of_week: d,
        hour_local: h,
        score: prior,
        n: 0,
        confidence: 0,
        weighted_er: 0,
        engagement_sum: 0,
      });
    }
  }
  return cells;
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function stddev(values: number[], center: number): number {
  if (values.length < 2) return 0;
  const v = values.reduce((acc, x) => acc + (x - center) * (x - center), 0) / values.length;
  return Math.sqrt(v);
}

export function isOutlierValue(
  value: number,
  population: number[],
  sigma = OPTIMAL_TIMES_OUTLIER_SIGMA,
): boolean {
  if (population.length < 5) return false;
  const sorted = [...population].sort((a, b) => a - b);
  const med = median(sorted);
  const sd = stddev(population, med);
  if (sd === 0) return false;
  return Math.abs(value - med) > sigma * sd;
}

function logistic(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

export function pickTopSlots(
  cells: Array<{ day_of_week: number; hour_local: number; score: number }>,
  n = OPTIMAL_TIMES_TOP_N,
  minGapHours = OPTIMAL_TIMES_MIN_GAP_HOURS,
): Array<{ day_of_week: number; hour_local: number; score: number }> {
  const ranked = [...cells].sort((a, b) => b.score - a.score || a.hour_local - b.hour_local);
  const picked: typeof ranked = [];
  for (const cell of ranked) {
    const clash = picked.some(
      (p) =>
        p.day_of_week === cell.day_of_week &&
        Math.abs(p.hour_local - cell.hour_local) < minGapHours,
    );
    if (!clash) picked.push(cell);
    if (picked.length >= n) break;
  }
  return picked;
}

export function excludeElapsedHours(
  slots: RankedSlot[],
  opts: { dateKey: string; now: Date; timezone: string },
): RankedSlot[] {
  const today = localWeekdayHour(opts.now, opts.timezone);
  if (opts.dateKey !== today.dayKey) {
    return slots.map((s, i) => ({ ...s, rank: i + 1 }));
  }
  return slots
    .filter((s) => s.hour_local >= today.hourLocal)
    .map((s, i) => ({ ...s, rank: i + 1 }));
}

export function slotsForDay(slots: RankedSlot[], dayOfWeek: number): RankedSlot[] {
  return slots.filter((s) => s.day_of_week === dayOfWeek).sort((a, b) => a.rank - b.rank);
}

function rankedFromCells(cells: HeatmapCell[]): RankedSlot[] {
  const out: RankedSlot[] = [];
  for (let day = 0; day < 7; day += 1) {
    const pool = cells.filter((c) => c.day_of_week === day);
    const picked = pickTopSlots(pool);
    picked.forEach((p, i) => {
      const cell = cells.find(
        (c) => c.day_of_week === p.day_of_week && c.hour_local === p.hour_local,
      );
      const confidence = cell?.confidence ?? 0;
      out.push({
        day_of_week: p.day_of_week,
        hour_local: p.hour_local,
        minute_of_day: p.hour_local * 60,
        rank: i + 1,
        score: p.score,
        confidence,
        n: cell?.n ?? 0,
        source: (cell?.n ?? 0) > 0 ? 'model' : 'prior',
        label: confidenceLabel(confidence),
      });
    });
  }
  return out;
}

export function computePageOptimalTimes(input: {
  snapshots: OptimalSnapshotInput[];
  network: string;
  timezone: string;
  now?: Date;
  kappa?: number;
}): PageOptimalTimes {
  const now = input.now ?? new Date();
  const kappa = input.kappa ?? OPTIMAL_TIMES_KAPPA;
  const tz = isUsableTimezone(input.timezone) ? input.timezone : 'UTC';
  const windowStart = new Date(now.getTime() - OPTIMAL_TIMES_WINDOW_DAYS * 86_400_000);

  const inWindow = input.snapshots.filter(
    (s) =>
      s.publishedAt instanceof Date &&
      !Number.isNaN(s.publishedAt.getTime()) &&
      s.publishedAt >= windowStart &&
      !s.excluded,
  );

  type Prepared = {
    dow: number;
    hour: number;
    weight: number;
    er: number;
    engagements: number;
  };

  const raw: Array<Prepared & { scoreForOutlier: number }> = [];
  const engagementTotals: number[] = [];

  for (const s of inWindow) {
    const likes = s.likes ?? 0;
    const comments = s.comments ?? 0;
    const shares = s.shares ?? 0;
    const engagements = likes + comments + shares;
    engagementTotals.push(engagements);
    const er =
      s.engagementRate ??
      engagementRate({
        likes: s.likes,
        comments: s.comments,
        shares: s.shares,
        reach: s.reach,
        impressions: s.impressions,
      });
    raw.push({
      dow: 0,
      hour: 0,
      weight: recencyWeight(ageInDays(s.publishedAt, now)),
      er: er ?? Number.NaN,
      engagements,
      scoreForOutlier: er ?? engagements,
    });
  }

  const needProxy = raw.some((r) => !Number.isFinite(r.er));
  let engMean = 0;
  let engStd = 0;
  if (needProxy && engagementTotals.length) {
    engMean = engagementTotals.reduce((a, b) => a + b, 0) / engagementTotals.length;
    engStd = stddev(engagementTotals, engMean);
  }

  const prepared: Prepared[] = [];
  const scores: number[] = [];
  raw.forEach((r, i) => {
    const snap = inWindow[i]!;
    let er = r.er;
    if (!Number.isFinite(er)) {
      const z = engStd > 0 ? (r.engagements - engMean) / engStd : 0;
      er = logistic(z);
    }
    scores.push(er);
    const slot = localWeekdayHour(snap.publishedAt, tz);
    prepared.push({
      dow: slot.dayOfWeek,
      hour: slot.hourLocal,
      weight: r.weight,
      er,
      engagements: r.engagements,
    });
  });

  const kept = prepared.filter((_p, i) => !isOutlierValue(scores[i]!, scores));
  const sampleSize = kept.length;

  const agg = new Map<string, { n: number; wEr: number; w: number; eng: number }>();
  for (const p of kept) {
    const key = `${p.dow}:${p.hour}`;
    const cur = agg.get(key) ?? { n: 0, wEr: 0, w: 0, eng: 0 };
    cur.n += 1;
    cur.wEr += p.er * p.weight;
    cur.w += p.weight;
    cur.eng += p.engagements * p.weight;
    agg.set(key, cur);
  }

  const cells: HeatmapCell[] = [];
  for (let d = 0; d < 7; d += 1) {
    for (let h = 0; h < 24; h += 1) {
      const cur = agg.get(`${d}:${h}`);
      const n = cur?.n ?? 0;
      const mean = cur && cur.w > 0 ? cur.wEr / cur.w : 0;
      const prior = industryPrior(input.network, d, h, tz);
      const score = shrinkScore(n, mean, prior, kappa);
      cells.push({
        day_of_week: d,
        hour_local: h,
        score,
        n,
        confidence: confidenceFromSamples(n, kappa),
        weighted_er: mean,
        engagement_sum: cur?.eng ?? 0,
      });
    }
  }

  return {
    status: optimalTimesStatus(sampleSize),
    sample_size: sampleSize,
    timezone: tz,
    network: input.network.trim().toLowerCase(),
    cells,
    slots: rankedFromCells(cells),
  };
}

export function heatmapMatrix(
  cells: HeatmapCell[],
  metric: 'rate' | 'engagements' = 'rate',
): Array<Array<{ score: number; n: number; confidence: number }>> {
  const grid = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => ({ score: 0, n: 0, confidence: 0 })),
  );
  let maxEng = 0;
  for (const c of cells) maxEng = Math.max(maxEng, c.engagement_sum);
  for (const c of cells) {
    if (c.day_of_week < 0 || c.day_of_week > 6 || c.hour_local < 0 || c.hour_local > 23) continue;
    const score = metric === 'engagements' ? (maxEng > 0 ? c.engagement_sum / maxEng : 0) : c.score;
    grid[c.day_of_week]![c.hour_local] = { score, n: c.n, confidence: c.confidence };
  }
  return grid;
}

export function dateKeyWeekday(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00Z`).getUTCDay();
}

export function formatSlotLabel(hourLocal: number): string {
  return `${String(hourLocal).padStart(2, '0')}:00`;
}
