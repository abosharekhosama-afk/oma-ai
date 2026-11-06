'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  DownOutlined,
} from '../../../../components/ui/lucide-icons';
import { useT } from '../../../../lib/use-locale';

export type DateRangePreset = '7' | '14' | '30' | 'thisMonth' | 'lastMonth' | 'quarter' | 'custom';

export type DateRangeValue = {
  preset: DateRangePreset;
  start: Date;
  end: Date;
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function resolveDateRange(
  preset: DateRangePreset,
  custom?: { start: Date; end: Date },
): DateRangeValue {
  const end = endOfDay(new Date());
  const start = startOfDay(new Date());
  if (preset === '7') start.setDate(end.getDate() - 6);
  else if (preset === '14') start.setDate(end.getDate() - 13);
  else if (preset === '30') start.setDate(end.getDate() - 29);
  else if (preset === 'thisMonth') start.setDate(1);
  else if (preset === 'lastMonth') {
    start.setMonth(start.getMonth() - 1, 1);
    end.setDate(0);
    end.setHours(23, 59, 59, 999);
  } else if (preset === 'quarter') start.setMonth(start.getMonth() - 3);
  else if (preset === 'custom' && custom) {
    return { preset, start: startOfDay(custom.start), end: endOfDay(custom.end) };
  } else start.setDate(end.getDate() - 6);
  return { preset, start, end };
}

function presetLabel(preset: DateRangePreset, t: (k: string) => string) {
  const map: Record<DateRangePreset, string> = {
    '7': t('listening.range7') || 'Last 7 days',
    '14': t('listening.range14') || 'Last 14 days',
    '30': t('listening.range30') || 'Last 30 days',
    thisMonth: t('listening.rangeThisMonth') || 'This month',
    lastMonth: t('listening.rangeLastMonth') || 'Last month',
    quarter: t('listening.rangeQuarter') || 'This quarter',
    custom: t('listening.rangeCustom') || 'Custom',
  };
  return map[preset];
}

function monthMatrix(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startPad; i += 1) cells.push(null);
  for (let d = 1; d <= days; d += 1) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function ListeningDateRange({
  value,
  onChange,
}: {
  value: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [draftPreset, setDraftPreset] = useState(value.preset);
  const [rangeStart, setRangeStart] = useState<Date | null>(value.start);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(value.end);
  const [cursorMonth, setCursorMonth] = useState(
    () => new Date(value.start.getFullYear(), value.start.getMonth(), 1),
  );
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const months = useMemo(
    () => [
      { y: cursorMonth.getFullYear(), m: cursorMonth.getMonth() },
      { y: cursorMonth.getFullYear(), m: cursorMonth.getMonth() + 1 },
    ],
    [cursorMonth],
  );

  const pickDay = (y: number, m: number, day: number) => {
    const d = startOfDay(new Date(y, m, day));
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(d);
      setRangeEnd(null);
      setDraftPreset('custom');
      return;
    }
    if (d < rangeStart) {
      setRangeEnd(rangeStart);
      setRangeStart(d);
    } else {
      setRangeEnd(d);
    }
    setDraftPreset('custom');
  };

  const apply = () => {
    if (draftPreset === 'custom' && rangeStart && rangeEnd) {
      onChange({ preset: 'custom', start: rangeStart, end: rangeEnd });
    } else {
      onChange(resolveDateRange(draftPreset));
    }
    setOpen(false);
  };

  const inRange = (y: number, m: number, day: number) => {
    if (!rangeStart) return false;
    const d = startOfDay(new Date(y, m, day)).getTime();
    const a = rangeStart.getTime();
    const b = (rangeEnd ?? rangeStart).getTime();
    return d >= Math.min(a, b) && d <= Math.max(a, b);
  };

  return (
    <div className="oma-plx-listening-date" ref={rootRef}>
      <button
        type="button"
        className="oma-plx-listening__range"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <CalendarOutlined />
        <span>{presetLabel(value.preset, t)}</span>
        <DownOutlined />
      </button>
      {open ? (
        <div className="oma-plx-listening-date__popover" role="dialog" aria-label="Date range">
          <div className="oma-plx-listening-date__calendars">
            <div className="oma-plx-listening-date__nav">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() =>
                  setCursorMonth(new Date(cursorMonth.getFullYear(), cursorMonth.getMonth() - 1, 1))
                }
              >
                <ArrowLeftOutlined />
              </button>
              <button
                type="button"
                aria-label="Next month"
                onClick={() =>
                  setCursorMonth(new Date(cursorMonth.getFullYear(), cursorMonth.getMonth() + 1, 1))
                }
              >
                <ArrowLeftOutlined className="oma-plx-listening-date__flip" />
              </button>
            </div>
            <div className="oma-plx-listening-date__months">
              {months.map(({ y, m }) => {
                const normM = ((m % 12) + 12) % 12;
                const normY = y + Math.floor(m / 12);
                const cells = monthMatrix(normY, normM);
                const title = new Date(normY, normM, 1).toLocaleDateString(undefined, {
                  month: 'long',
                  year: 'numeric',
                });
                return (
                  <div key={`${normY}-${normM}`} className="oma-plx-listening-date__month">
                    <div className="oma-plx-listening-date__month-title">{title}</div>
                    <div className="oma-plx-listening-date__weekdays">
                      {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((w) => (
                        <span key={w}>{w}</span>
                      ))}
                    </div>
                    <div className="oma-plx-listening-date__grid">
                      {cells.map((day, idx) =>
                        day ? (
                          <button
                            key={idx}
                            type="button"
                            className={`oma-plx-listening-date__day${
                              inRange(normY, normM, day) ? ' in-range' : ''
                            }${
                              rangeStart &&
                              startOfDay(new Date(normY, normM, day)).getTime() ===
                                rangeStart.getTime()
                                ? ' is-start'
                                : ''
                            }${
                              rangeEnd &&
                              startOfDay(new Date(normY, normM, day)).getTime() ===
                                rangeEnd.getTime()
                                ? ' is-end'
                                : ''
                            }`}
                            onClick={() => pickDay(normY, normM, day)}
                          >
                            {day}
                          </button>
                        ) : (
                          <span
                            key={idx}
                            className="oma-plx-listening-date__day oma-plx-listening-date__day--empty"
                          />
                        ),
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="oma-plx-listening-date__presets">
            {(
              ['7', '14', '30', 'thisMonth', 'lastMonth', 'quarter', 'custom'] as DateRangePreset[]
            ).map((p) => (
              <label key={p} className="oma-plx-listening-date__preset">
                <input
                  type="radio"
                  name="listening-range"
                  checked={draftPreset === p}
                  onChange={() => {
                    setDraftPreset(p);
                    if (p !== 'custom') {
                      const r = resolveDateRange(p);
                      setRangeStart(r.start);
                      setRangeEnd(r.end);
                    }
                  }}
                />
                {presetLabel(p, t)}
              </label>
            ))}
            <button type="button" className="oma-plx-listening-date__apply" onClick={apply}>
              {t('listening.applyRange') || 'Apply'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
