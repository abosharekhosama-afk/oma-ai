'use client';

import { useEffect, useState } from 'react';
import { getActiveBrandId } from '../../lib/active-brand';
import {
  getOptimalTimeSuggestions,
  type OptimalSlot,
  type OptimalSuggest,
} from '../../lib/optimal-times-api';
import { useT } from '../../lib/use-locale';

export function BestTimeSuggestions({
  socialPageIds,
  date,
  brandId,
  onPick,
  compact = false,
}: {
  socialPageIds: string[];
  date?: string;
  brandId?: string | null;
  onPick: (localDateTime: string) => void;
  compact?: boolean;
}) {
  const t = useT();
  const [data, setData] = useState<OptimalSuggest | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const day = date && /^\d{4}-\d{2}-\d{2}/.test(date) ? date.slice(0, 10) : undefined;
    void getOptimalTimeSuggestions({
      brandId: brandId ?? getActiveBrandId(),
      socialPageIds,
      date: day,
    })
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [brandId, date, socialPageIds.join(',')]);

  const slots: OptimalSlot[] = data?.slots ?? [];

  function pick(slot: OptimalSlot) {
    const day = data?.date ?? date?.slice(0, 10);
    if (!day) return;
    const hh = String(Math.floor(slot.minute_of_day / 60)).padStart(2, '0');
    const mm = String(slot.minute_of_day % 60).padStart(2, '0');
    onPick(`${day}T${hh}:${mm}`);
  }

  return (
    <div
      className={`oma-ot-suggest${compact ? ' oma-ot-suggest--compact' : ''}`}
      data-testid="optimal-times-suggest"
    >
      <p className="oma-ot-suggest__title">{t('content.bestTime.title')}</p>
      {error ? <p className="oma-ot-suggest__hint">{t('content.bestTime.empty')}</p> : null}
      {!error && data?.conflict ? (
        <p className="oma-ot-suggest__hint">{t('content.bestTime.conflict')}</p>
      ) : null}
      {!error && data && slots.length === 0 ? (
        <p className="oma-ot-suggest__hint">
          {socialPageIds.length === 0 ? t('content.bestTime.connect') : t('content.bestTime.empty')}
        </p>
      ) : null}
      {slots.length ? (
        <ul className="oma-ot-suggest__list">
          {slots.map((slot) => (
            <li key={`${slot.day_of_week}-${slot.minute_of_day}`}>
              <button
                type="button"
                className="oma-ot-suggest__slot"
                data-confidence={slot.label}
                onClick={() => pick(slot)}
              >
                <span className="oma-ot-suggest__time">{slot.time_label}</span>
                <span
                  className="oma-ot-suggest__bar"
                  aria-hidden
                  style={{ ['--ot-conf' as string]: String(slot.confidence) }}
                />
                <span className="oma-ot-suggest__conf">
                  {t(`analytics.optimal.confidence.${slot.label}`)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
