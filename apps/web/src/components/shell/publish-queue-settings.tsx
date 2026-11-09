'use client';

import { useEffect, useState } from 'react';
import { Button, Input, SelectField } from '@oma/ui/controls';
import {
  listPublishQueues,
  savePublishQueue,
  type PublishQueue,
} from '../../lib/publish-queues-api';

export function PublishQueueSettings({
  brandId,
  t,
}: {
  brandId: string | null;
  t: (key: string) => string;
}) {
  const [items, setItems] = useState<PublishQueue[]>([]);
  const [pageId, setPageId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [manualTime, setManualTime] = useState('10:00');
  const [manualDay, setManualDay] = useState('1');

  useEffect(() => {
    if (!brandId) return;
    listPublishQueues(brandId)
      .then((res) => {
        setItems(res.items ?? []);
        setPageId((prev) => prev || res.items?.[0]?.social_page_id || '');
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, [brandId]);

  const current = items.find((q) => q.social_page_id === pageId) ?? items[0] ?? null;

  async function persist(patch: Partial<PublishQueue> & { social_page_id: string }) {
    if (!current && !patch.social_page_id) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await savePublishQueue({
        social_page_id: patch.social_page_id,
        enabled: patch.enabled,
        slots_per_day: patch.slots_per_day,
        window_start: patch.window_start,
        window_end: patch.window_end,
        use_suggested: patch.use_suggested,
        manual_slots: patch.manual_slots?.map((s) => ({
          day_of_week: s.day_of_week,
          time_local: s.time_local,
          enabled: s.enabled,
        })),
      });
      setItems((prev) => prev.map((q) => (q.social_page_id === saved.social_page_id ? saved : q)));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="oma-ws-queue" data-testid="ws-publish-queue">
      <h3 className="oma-ws-section-title">{t('wsPanel.queue.title')}</h3>
      <p className="oma-muted">{t('wsPanel.queue.help')}</p>
      {!brandId || items.length === 0 ? (
        <p className="oma-muted">{t('wsPanel.queue.emptyAccounts')}</p>
      ) : (
        <>
          <div className="oma-ws-field">
            <label className="oma-ws-label">{t('wsPanel.queue.account')}</label>
            <SelectField
              value={current?.social_page_id ?? pageId}
              onChange={(e) => setPageId(e.target.value)}
            >
              {items.map((q) => (
                <option key={q.social_page_id} value={q.social_page_id}>
                  {q.name} ({q.network})
                </option>
              ))}
            </SelectField>
          </div>
          {current ? (
            <>
              <label className="oma-ws-check">
                <input
                  type="checkbox"
                  checked={current.enabled}
                  disabled={saving}
                  onChange={(e) =>
                    void persist({
                      social_page_id: current.social_page_id,
                      enabled: e.target.checked,
                    })
                  }
                />
                {t('wsPanel.queue.enable')}
              </label>
              <label className="oma-ws-check">
                <input
                  type="checkbox"
                  checked={current.use_suggested}
                  disabled={saving}
                  onChange={(e) =>
                    void persist({
                      social_page_id: current.social_page_id,
                      use_suggested: e.target.checked,
                    })
                  }
                />
                {t('wsPanel.queue.useSuggested')}
              </label>
              <div className="oma-ws-field">
                <label className="oma-ws-label">{t('wsPanel.queue.slotsPerDay')}</label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={String(current.slots_per_day)}
                  onChange={(e) =>
                    void persist({
                      social_page_id: current.social_page_id,
                      slots_per_day: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="oma-ws-slot-row">
                <div className="oma-ws-field">
                  <label className="oma-ws-label">{t('wsPanel.queue.windowStart')}</label>
                  <Input
                    value={current.window_start ?? ''}
                    placeholder="08:00"
                    onBlur={(e) =>
                      void persist({
                        social_page_id: current.social_page_id,
                        window_start: e.target.value || null,
                      })
                    }
                    onChange={() => undefined}
                  />
                </div>
                <div className="oma-ws-field">
                  <label className="oma-ws-label">{t('wsPanel.queue.windowEnd')}</label>
                  <Input
                    value={current.window_end ?? ''}
                    placeholder="21:00"
                    onBlur={(e) =>
                      void persist({
                        social_page_id: current.social_page_id,
                        window_end: e.target.value || null,
                      })
                    }
                    onChange={() => undefined}
                  />
                </div>
              </div>
              <ul className="oma-ws-label-list">
                {current.resolved_slots.map((s) => (
                  <li
                    key={`${s.origin}-${s.day_of_week}-${s.time_local}`}
                    className="oma-ws-label-item"
                  >
                    <span
                      className={`oma-sched-best-dot oma-sched-best-dot--${s.origin === 'optimal' ? 'high' : 'medium'}`}
                    />
                    <span style={{ flex: 1 }}>
                      {t(`analytics.optimal.days.${s.day_of_week}`)} · {s.time_local} ·{' '}
                      {t(`wsPanel.queue.origin.${s.origin}`)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="oma-ws-slot-row">
                <SelectField value={manualDay} onChange={(e) => setManualDay(e.target.value)}>
                  {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                    <option key={d} value={String(d)}>
                      {t(`analytics.optimal.days.${d}`)}
                    </option>
                  ))}
                </SelectField>
                <Input value={manualTime} onChange={(e) => setManualTime(e.target.value)} />
                <Button
                  type="default"
                  disabled={saving}
                  onClick={() => {
                    const next = [
                      ...current.manual_slots,
                      {
                        day_of_week: Number(manualDay),
                        time_local: manualTime,
                        enabled: true,
                        origin: 'manual' as const,
                      },
                    ];
                    void persist({ social_page_id: current.social_page_id, manual_slots: next });
                  }}
                >
                  {t('wsPanel.queue.addManual')}
                </Button>
              </div>
            </>
          ) : null}
        </>
      )}
      {error ? <p className="oma-ws-error">{error}</p> : null}
    </div>
  );
}
