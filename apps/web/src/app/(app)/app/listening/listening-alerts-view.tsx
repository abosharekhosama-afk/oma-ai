'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@oma/ui/controls';
import { MoreOutlined, PlusOutlined } from '../../../../components/ui/lucide-icons';
import { useActiveBrandId } from '../../../../lib/active-brand';
import {
  createListeningAlert,
  deleteListeningAlert,
  listListeningAlerts,
  updateListeningAlert,
  type ListeningAlertRow,
} from '../../../../lib/listening-api';
import { useLocale } from '../../../../lib/use-locale';

const ENTITY_COLORS = ['#1570ef', '#ee46bc', '#f79009', '#0e9f95'];

function formatLastFired(iso: string | null, locale: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(locale.startsWith('ar') ? 'ar' : 'en', {
    day: 'numeric',
    month: 'short',
  });
}

export function ListeningAlertsView() {
  const locale = useLocale();
  const ar = locale.startsWith('ar');
  const brandId = useActiveBrandId();
  const [rows, setRows] = useState<ListeningAlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [draftName, setDraftName] = useState('Volume spike');
  const [trigger, setTrigger] = useState<
    'VOLUME_SPIKE' | 'SENTIMENT_POSITIVE' | 'SENTIMENT_NEGATIVE'
  >('VOLUME_SPIKE');
  const [mentionsPerDay, setMentionsPerDay] = useState(36);
  const [sharePct, setSharePct] = useState(75);
  const [notifyInApp, setNotifyInApp] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [notifySlack, setNotifySlack] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listListeningAlerts(brandId || undefined);
      setRows(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load alerts');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onToggle = async (row: ListeningAlertRow) => {
    await updateListeningAlert(row.id, { isActive: !row.isActive });
    await load();
  };

  const onDelete = async (id: string) => {
    if (!window.confirm(ar ? 'حذف التنبيه؟' : 'Delete this alert?')) return;
    await deleteListeningAlert(id);
    setMenuId(null);
    await load();
  };

  const onCreate = async () => {
    const threshold: Record<string, number> =
      trigger === 'VOLUME_SPIKE' ? { mentionsPerDay: mentionsPerDay } : { sharePct: sharePct };
    await createListeningAlert({
      name: draftName.trim() || 'Alert',
      brandId: brandId || null,
      triggerType: trigger,
      threshold,
      notifyInApp,
      notifyEmail,
      notifySlack,
    });
    setModalOpen(false);
    await load();
  };

  return (
    <div className="oma-plx-listening oma-plx-listening-alerts" data-testid="listening-alerts-page">
      <header className="oma-plx-listening-alerts__head">
        <h1 className="oma-plx-listening__title">{ar ? 'التنبيهات' : 'Alerts'}</h1>
        <Button type="primary" size="small" onClick={() => setModalOpen(true)}>
          <PlusOutlined /> {ar ? 'تنبيه جديد' : 'New alert'}
        </Button>
      </header>

      {error ? (
        <p className="oma-inbox-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="oma-plx-listening-alerts__table-wrap">
        <table className="oma-plx-listening-alerts__table">
          <thead>
            <tr>
              <th>{ar ? 'التنبيه' : 'Alert'}</th>
              <th>{ar ? 'المنصات' : 'Platforms'}</th>
              <th>{ar ? 'يُفعّل عندما' : 'Fires when'}</th>
              <th>{ar ? 'آخر تفعيل' : 'Last fired'}</th>
              <th>{ar ? 'نشط' : 'Active'}</th>
              <th aria-hidden />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6}>{ar ? 'جاري التحميل…' : 'Loading…'}</td>
              </tr>
            ) : null}
            {!loading && !rows.length ? (
              <tr>
                <td colSpan={6}>
                  {ar
                    ? 'لا توجد تنبيهات. أنشئ تنبيهاً لمتابعة ذروة الإشارات أو تحول المشاعر.'
                    : 'No alerts yet. Create one to watch mention spikes or sentiment shifts.'}
                </td>
              </tr>
            ) : null}
            {rows.map((row, i) => (
              <tr key={row.id} data-testid={`listening-alert-${row.id}`}>
                <td>
                  <span
                    className="oma-plx-listening-alerts__dot"
                    style={{ background: ENTITY_COLORS[i % ENTITY_COLORS.length] }}
                    aria-hidden
                  />
                  {row.name}
                </td>
                <td>{row.platformsLabel}</td>
                <td>{row.firesWhen}</td>
                <td>{formatLastFired(row.lastFiredAt, locale)}</td>
                <td>
                  <button
                    type="button"
                    className={`oma-plx-listening-alerts__toggle${row.isActive ? ' is-on' : ''}`}
                    aria-pressed={row.isActive}
                    onClick={() => void onToggle(row)}
                  />
                </td>
                <td className="oma-plx-listening-alerts__menu-cell">
                  <button
                    type="button"
                    className="oma-plx-listening-icon-btn"
                    aria-label={ar ? 'إجراءات' : 'Actions'}
                    onClick={() => setMenuId(menuId === row.id ? null : row.id)}
                  >
                    <MoreOutlined />
                  </button>
                  {menuId === row.id ? (
                    <div className="oma-plx-listening-alerts__menu" role="menu">
                      <button type="button" role="menuitem" onClick={() => void onDelete(row.id)}>
                        {ar ? 'حذف التنبيه' : 'Delete alert'}
                      </button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="oma-plx-listening-alerts__footnote">
        {ar
          ? 'تُجمَع الإشارات بين عشية وضحاها. إذا تجاوز أمس العتبة، يُحدَّث عمود «آخر تفعيل» ويُفعَّل إشعار داخل التطبيق عند تفعيله.'
          : 'Mentions are collected overnight. When yesterday crosses your threshold, Last fired updates and in-app notify fires when enabled.'}
      </p>

      {modalOpen ? (
        <div className="oma-plx-listening-alerts__modal" role="dialog" aria-modal="true">
          <div className="oma-plx-listening-alerts__dialog">
            <header>
              <h2>{ar ? 'إنشاء تنبيه' : 'Create new alert'}</h2>
              <button type="button" onClick={() => setModalOpen(false)} aria-label="Close">
                ×
              </button>
            </header>
            <label>
              <span>{ar ? 'الاسم' : 'Name'}</span>
              <input value={draftName} onChange={(e) => setDraftName(e.target.value)} />
            </label>
            <fieldset>
              <legend>{ar ? 'نبّهني عندما' : 'Alert me when'}</legend>
              <label>
                <input
                  type="radio"
                  name="trig"
                  checked={trigger === 'VOLUME_SPIKE'}
                  onChange={() => setTrigger('VOLUME_SPIKE')}
                />
                {ar ? 'يوم يتجاوز فيه عدد الإشارات المعتاد' : 'A day has more mentions than usual'}
              </label>
              <label>
                <input
                  type="radio"
                  name="trig"
                  checked={trigger === 'SENTIMENT_POSITIVE'}
                  onChange={() => setTrigger('SENTIMENT_POSITIVE')}
                />
                {ar ? 'ارتفاع نسبة المشاعر الإيجابية' : 'Sentiment share shifts (positive)'}
              </label>
              <label>
                <input
                  type="radio"
                  name="trig"
                  checked={trigger === 'SENTIMENT_NEGATIVE'}
                  onChange={() => setTrigger('SENTIMENT_NEGATIVE')}
                />
                {ar ? 'ارتفاع نسبة المشاعر السلبية' : 'Sentiment share shifts (negative)'}
              </label>
            </fieldset>
            {trigger === 'VOLUME_SPIKE' ? (
              <label>
                <span>{ar ? 'العتبة (إشارات/يوم)' : 'Threshold (mentions / day)'}</span>
                <input
                  type="range"
                  min={1}
                  max={200}
                  value={mentionsPerDay}
                  onChange={(e) => setMentionsPerDay(Number(e.target.value))}
                />
                <output>{mentionsPerDay}</output>
              </label>
            ) : (
              <label>
                <span>{ar ? 'نسبة المشاعر %' : 'Sentiment share %'}</span>
                <input
                  type="range"
                  min={5}
                  max={100}
                  value={sharePct}
                  onChange={(e) => setSharePct(Number(e.target.value))}
                />
                <output>{sharePct}%</output>
              </label>
            )}
            <fieldset>
              <legend>{ar ? 'الإشعار عبر' : 'Notify via'}</legend>
              <label>
                <input
                  type="checkbox"
                  checked={notifyInApp}
                  onChange={(e) => setNotifyInApp(e.target.checked)}
                />
                {ar ? 'داخل التطبيق' : 'In-app'}
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={notifyEmail}
                  onChange={(e) => setNotifyEmail(e.target.checked)}
                />
                Email
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={notifySlack}
                  onChange={(e) => setNotifySlack(e.target.checked)}
                />
                Slack
              </label>
            </fieldset>
            <footer>
              <Button onClick={() => setModalOpen(false)}>{ar ? 'إلغاء' : 'Cancel'}</Button>
              <Button type="primary" onClick={() => void onCreate()}>
                {ar ? 'إنشاء التنبيه' : 'Create alert'}
              </Button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
