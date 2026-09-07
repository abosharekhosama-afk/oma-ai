/**
 * Shared CSV usage parsing — deterministic, no estimates.
 */
import fs from 'node:fs';

export function parseCsv(text) {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((l) => l.length);
  if (!lines.length) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? '';
    });
    return row;
  });
}

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

export function parseUsageCsv(filePath) {
  return parseCsv(fs.readFileSync(filePath, 'utf8'));
}

export function toInt(v) {
  const n = Number(
    String(v ?? '')
      .replace(/,/g, '')
      .trim(),
  );
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

export function toMoney(v) {
  const s = String(v ?? '').trim();
  if (!s || s === 'Free' || s === 'Included' || s === '-' || s === '—') return 0;
  const n = Number(s.replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

const PREMIUM_MARKERS = [
  'fable',
  'sol',
  'sonnet',
  'opus',
  'grok',
  'gemini',
  'composer',
  'claude',
  'gpt-5',
];

export function isPremiumish(model, kind) {
  const m = String(model || '').toLowerCase();
  if (kind === 'On-Demand') return true;
  return PREMIUM_MARKERS.some((p) => m.includes(p));
}

export function summarizeUsage(rows) {
  const kinds = {};
  let totalTokens = 0;
  let cacheRead = 0;
  let onDemandEvents = 0;
  let onDemandCost = 0;
  const byModel = {};
  const byDay = {};
  const buckets = {};

  for (const r of rows) {
    const kind = r.Kind || '(unknown)';
    kinds[kind] = (kinds[kind] || 0) + 1;
    const tokens = toInt(r['Total Tokens']);
    const cache = toInt(r['Cache Read']);
    totalTokens += tokens;
    cacheRead += cache;
    const model = r.Model || '(empty)';
    byModel[model] ??= { events: 0, tokens: 0, cache: 0, onDemand: 0, cost: 0 };
    byModel[model].events += 1;
    byModel[model].tokens += tokens;
    byModel[model].cache += cache;
    if (kind === 'On-Demand') {
      onDemandEvents += 1;
      const cost = toMoney(r.Cost);
      onDemandCost += cost;
      byModel[model].onDemand += 1;
      byModel[model].cost += cost;
    }
    const day = String(r.Date || '').slice(0, 10);
    byDay[day] ??= { events: 0, tokens: 0, onDemand: 0, cost: 0 };
    byDay[day].events += 1;
    byDay[day].tokens += tokens;
    if (kind === 'On-Demand') {
      byDay[day].onDemand += 1;
      byDay[day].cost += toMoney(r.Cost);
    }
    if (isPremiumish(model, kind)) {
      const minute = String(r.Date || '').slice(0, 16);
      buckets[minute] ??= new Set();
      buckets[minute].add(model);
    }
  }

  const fanOut = Object.entries(buckets)
    .filter(([, set]) => set.size >= 3)
    .map(([minute, set]) => ({ minute, models: [...set].sort() }))
    .sort((a, b) => b.models.length - a.models.length);

  const topPaid = rows
    .filter((r) => r.Kind === 'On-Demand')
    .map((r) => ({
      date: r.Date,
      model: r.Model,
      cost: toMoney(r.Cost),
      tokens: toInt(r['Total Tokens']),
      cache: toInt(r['Cache Read']),
    }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 10);

  const topToken = [...rows]
    .map((r) => ({
      date: r.Date,
      kind: r.Kind,
      model: r.Model,
      tokens: toInt(r['Total Tokens']),
      cache: toInt(r['Cache Read']),
      cost: r.Cost,
    }))
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 10);

  return {
    totalEvents: rows.length,
    kinds,
    onDemandEvents,
    onDemandCost: Math.round(onDemandCost * 100) / 100,
    totalTokens,
    cacheRead,
    cacheReadSharePct: totalTokens ? Math.round((10000 * cacheRead) / totalTokens) / 100 : 0,
    byModel,
    byDay,
    fanOutMinutesGe3: fanOut.length,
    fanOutSamples: fanOut.slice(0, 10),
    topPaid,
    topToken,
    findings: {
      historicalModelFanOut: fanOut.length > 0 ? 'PROVEN' : 'NOT_PROVEN',
      contextReplay:
        totalTokens && cacheRead / totalTokens >= 0.7
          ? 'PROVEN'
          : totalTokens
            ? 'WEAK'
            : 'NOT_OBSERVABLE',
      silentOpenCodeToCursorFallback: 'UNRESOLVED',
    },
  };
}
