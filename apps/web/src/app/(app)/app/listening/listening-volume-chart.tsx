'use client';

import type { DaySentiment } from './listening-utils';

const COLORS = {
  positive: '#22c55e',
  neutral: '#eab308',
  negative: '#ef4444',
  total: '#2563eb',
};

function formatDayTitle(key: string) {
  const d = new Date(`${key}T12:00:00`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function pct(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

export function ListeningVolumeChart({
  series,
  mode,
  selectedIndex,
  onSelectIndex,
}: {
  series: DaySentiment[];
  mode: 'total' | 'sentiment';
  selectedIndex: number | null;
  onSelectIndex: (index: number | null) => void;
}) {
  const w = 720;
  const h = 200;
  const padL = 36;
  const padR = 12;
  const padT = 12;
  const padB = 8;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  const max = Math.max(
    1,
    ...series.map((d) => (mode === 'total' ? d.total : d.positive + d.neutral + d.negative)),
  );
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((p) => Math.round(max * p));

  const step = chartW / Math.max(1, series.length - 1);
  const xAt = (i: number) => padL + i * step;
  const yAt = (v: number) => padT + chartH - (v / max) * chartH;

  const buildArea = (key: 'positive' | 'neutral' | 'negative' | 'total') => {
    if (!series.length) return '';
    const pts = series.map((d, i) => {
      const v = mode === 'total' ? d.total : d[key as 'positive' | 'neutral' | 'negative'];
      return [xAt(i), yAt(v)] as const;
    });
    const baseline = padT + chartH;
    let d = `M ${pts[0]![0]} ${baseline} L ${pts[0]![0]} ${pts[0]![1]}`;
    for (let i = 1; i < pts.length; i += 1) d += ` L ${pts[i]![0]} ${pts[i]![1]}`;
    d += ` L ${pts[pts.length - 1]![0]} ${baseline} Z`;
    return d;
  };

  const buildLine = (key: 'positive' | 'neutral' | 'negative' | 'total') =>
    series
      .map((d, i) => {
        const v = mode === 'total' ? d.total : d[key as 'positive' | 'neutral' | 'negative'];
        return `${xAt(i)},${yAt(v)}`;
      })
      .join(' ');

  const selected = selectedIndex != null ? series[selectedIndex] : null;
  const tooltipLeft =
    selectedIndex != null ? Math.min(Math.max(xAt(selectedIndex) - 80, 8), w - 168) : 0;
  const tooltipTop = selectedIndex != null ? Math.max(yAt(selected?.total ?? 0) - 8, 24) : 0;

  return (
    <div className="oma-plx-listening-chart oma-plx-listening-chart--interactive">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Mention volume">
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={padL}
              x2={w - padR}
              y1={yAt(tick)}
              y2={yAt(tick)}
              className="oma-plx-listening-chart__grid"
            />
            <text x={padL - 8} y={yAt(tick) + 4} className="oma-plx-listening-chart__ylabel" textAnchor="end">
              {tick}
            </text>
          </g>
        ))}
        {mode === 'total' ? (
          <>
            <path d={buildArea('total')} className="oma-plx-listening-chart__area oma-plx-listening-chart__area--total" />
            <polyline fill="none" stroke={COLORS.total} strokeWidth="2.5" points={buildLine('total')} />
          </>
        ) : (
          <>
            <path d={buildArea('negative')} className="oma-plx-listening-chart__area oma-plx-listening-chart__area--neg" />
            <path d={buildArea('neutral')} className="oma-plx-listening-chart__area oma-plx-listening-chart__area--neu" />
            <path d={buildArea('positive')} className="oma-plx-listening-chart__area oma-plx-listening-chart__area--pos" />
            <polyline fill="none" stroke={COLORS.negative} strokeWidth="2" points={buildLine('negative')} />
            <polyline fill="none" stroke={COLORS.neutral} strokeWidth="2" points={buildLine('neutral')} />
            <polyline fill="none" stroke={COLORS.positive} strokeWidth="2" points={buildLine('positive')} />
          </>
        )}
        {series.map((d, i) => {
          const v = mode === 'total' ? d.total : d.positive + d.neutral + d.negative;
          const cx = xAt(i);
          const cy = yAt(v);
          const active = selectedIndex === i;
          return (
            <g key={d.key}>
              <circle
                cx={cx}
                cy={cy}
                r={active ? 7 : 5}
                className={`oma-plx-listening-chart__point${active ? ' is-active' : ''}`}
                onClick={() => onSelectIndex(active ? null : i)}
              />
              <rect
                x={cx - step / 2}
                y={padT}
                width={step}
                height={chartH}
                fill="transparent"
                className="oma-plx-listening-chart__hit"
                onClick={() => onSelectIndex(i)}
              />
            </g>
          );
        })}
      </svg>
      {selected && selectedIndex != null ? (
        <div
          className="oma-plx-listening-chart__analysis"
          style={{ left: `${(tooltipLeft / w) * 100}%`, top: `${(tooltipTop / h) * 100}%` }}
          role="status"
        >
          <header>{formatDayTitle(selected.key)}</header>
          <ul>
            <li>
              <i className="dot dot--pos" aria-hidden /> Positive{' '}
              <span>
                {selected.positive} ({pct(selected.positive, selected.total)}%)
              </span>
            </li>
            <li>
              <i className="dot dot--neu" aria-hidden /> Neutral{' '}
              <span>
                {selected.neutral} ({pct(selected.neutral, selected.total)}%)
              </span>
            </li>
            <li>
              <i className="dot dot--neg" aria-hidden /> Negative{' '}
              <span>
                {selected.negative} ({pct(selected.negative, selected.total)}%)
              </span>
            </li>
          </ul>
          <footer>
            <span>Total mentions</span>
            <strong>{selected.total}</strong>
          </footer>
        </div>
      ) : null}
      <div className="oma-plx-listening-chart__x">
        {series.map((d) => (
          <span key={d.key}>{d.label}</span>
        ))}
      </div>
      {mode === 'sentiment' ? (
        <div className="oma-plx-listening-chart__legend">
          <span>
            <i className="dot dot--pos" /> Positive
          </span>
          <span>
            <i className="dot dot--neu" /> Neutral
          </span>
          <span>
            <i className="dot dot--neg" /> Negative
          </span>
        </div>
      ) : null}
    </div>
  );
}
