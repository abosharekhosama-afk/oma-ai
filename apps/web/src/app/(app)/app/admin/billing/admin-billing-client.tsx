'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@oma/ui/controls';
import { useLocale } from '../../../../../lib/use-locale';
import { useToast } from '../../../../../components/ui/toast';
import { useCapabilities } from '../../../../../lib/use-capabilities';
import {
  adminActivateWorkspace,
  adminBillingSettings,
  adminCancelWorkspace,
  adminExtendWorkspace,
  adminListOrders,
  adminListWorkspaces,
  adminReviewOrder,
  adminUpdateSettings,
  planErrorFromUnknown,
} from '../../../../../lib/billing-api';
import '../../../billing/billing.css';

export default function AdminBillingClient() {
  const isAr = useLocale() === 'ar';
  const toast = useToast();
  const caps = useCapabilities();
  const [allowed, setAllowed] = useState<boolean | null>(
    caps.can('platform.support.access') ? true : null,
  );
  const [q, setQ] = useState('');
  const [workspaces, setWorkspaces] = useState<Array<Record<string, unknown>>>([]);
  const [orders, setOrders] = useState<Array<Record<string, unknown>>>([]);
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [selected, setSelected] = useState('');
  const [plan, setPlan] = useState('pro');
  const [note, setNote] = useState('');
  const [reference, setReference] = useState('');
  const [days, setDays] = useState('30');
  const [vat, setVat] = useState('17');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [w, o, s] = await Promise.all([
        adminListWorkspaces(q || undefined),
        adminListOrders(),
        adminBillingSettings(),
      ]);
      setAllowed(true);
      setWorkspaces(w.data ?? []);
      setOrders(o.data ?? []);
      setSettings(s.data ?? {});
      if (s.data?.vatRateBps) setVat(String(Number(s.data.vatRateBps) / 100));
    } catch (err) {
      const denied =
        (err as { status?: number; code?: string } | null)?.status === 403 ||
        (err as { code?: string } | null)?.code === 'PERMISSION_DENIED';
      setAllowed((prev) => (denied ? false : (prev ?? false)));
      if (!denied) {
        toast.push(
          planErrorFromUnknown(err, isAr) ||
            (err instanceof Error ? err.message : null) ||
            (isAr ? 'تعذر تحميل إدارة الفوترة' : 'Could not load admin billing'),
          'danger',
        );
      } else {
        setAllowed(false);
      }
    }
  }, [isAr, q, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  if (allowed === null || caps.loading) {
    return (
      <main className="oma-planable-page oma-billing" dir={isAr ? 'rtl' : 'ltr'}>
        <p>{isAr ? 'جاري التحميل…' : 'Loading…'}</p>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="oma-planable-page oma-billing" dir={isAr ? 'rtl' : 'ltr'}>
        <h1>{isAr ? 'غير مصرح' : 'Not authorized'}</h1>
        <p>{isAr ? 'هذه الصفحة لمالك المنصة فقط.' : 'This page is only for the platform owner.'}</p>
      </main>
    );
  }

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.push(ok, 'success');
      await load();
    } catch (err) {
      toast.push(
        planErrorFromUnknown(err, isAr) ||
          (err instanceof Error ? err.message : null) ||
          (isAr ? 'تعذر تنفيذ الإجراء' : 'Could not complete that action'),
        'danger',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="oma-planable-page oma-billing" dir={isAr ? 'rtl' : 'ltr'}>
      <h1 className="oma-planable-page__title">{isAr ? 'فوترة المنصة' : 'Platform billing'}</h1>
      <p className="oma-planable-page__sub">
        {isAr
          ? 'تفعيل الخطط يدوياً، مراجعة إثباتات الدفع، وتعديل نسبة الضريبة.'
          : 'Manually activate plans, review payment proof, and edit the VAT rate.'}
      </p>

      <section className="oma-billing__notice">
        <h2>{isAr ? 'إعدادات الضريبة' : 'VAT settings'}</h2>
        <label>
          {isAr ? 'نسبة الضريبة %' : 'VAT %'}
          <input value={vat} onChange={(e) => setVat(e.target.value)} />
        </label>
        <Button
          type="primary"
          disabled={busy}
          onClick={() =>
            void run(
              () => adminUpdateSettings({ vat_rate_bps: Math.round(Number(vat) * 100) }),
              isAr ? 'تم حفظ الضريبة' : 'VAT saved',
            )
          }
        >
          {isAr ? 'حفظ' : 'Save'}
        </Button>
        <p>
          {isAr ? 'المهلة الحالية' : 'Current grace'}: {String(settings.gracePeriodDays ?? 7)}{' '}
          {isAr ? 'يوماً' : 'days'}
        </p>
      </section>

      <section className="oma-billing__notice">
        <h2>{isAr ? 'مساحات العمل' : 'Workspaces'}</h2>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={isAr ? 'بحث' : 'Search'}
        />
        <ul>
          {workspaces.map((w) => (
            <li key={String(w.id)}>
              <button type="button" onClick={() => setSelected(String(w.id))}>
                {String(w.name)} ({String(w.slug)}) — {String(w.plan_code ?? '—')} /{' '}
                {String(w.status ?? '—')}
              </button>
            </li>
          ))}
        </ul>
        {selected ? (
          <div>
            <p>
              {isAr ? 'المحدد' : 'Selected'}: {selected}
            </p>
            <select value={plan} onChange={(e) => setPlan(e.target.value)}>
              <option value="starter">{isAr ? 'البداية' : 'Starter'}</option>
              <option value="pro">{isAr ? 'الاحترافية' : 'Pro'}</option>
              <option value="agency">{isAr ? 'الوكالة' : 'Agency'}</option>
            </select>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={isAr ? 'المرجع / الإيصال' : 'Reference / receipt'}
            />
            <input
              value={days}
              onChange={(e) => setDays(e.target.value)}
              placeholder={isAr ? 'أيام التمديد' : 'Extend days'}
            />
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={isAr ? 'ملاحظة' : 'Note'}
            />
            <Button
              type="primary"
              disabled={busy}
              onClick={() =>
                void run(
                  () =>
                    adminActivateWorkspace(selected, {
                      plan_code: plan,
                      reference,
                      note,
                      days: days ? Number(days) : undefined,
                    }),
                  isAr ? 'تم تفعيل الخطة' : 'Plan activated',
                )
              }
            >
              {isAr ? 'تفعيل' : 'Activate'}
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                void run(
                  () => adminExtendWorkspace(selected, { days: Number(days || 0), note }),
                  isAr ? 'تم التمديد' : 'Extended',
                )
              }
            >
              {isAr ? 'تمديد' : 'Extend'}
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                void run(
                  () => adminCancelWorkspace(selected, { note }),
                  isAr ? 'تم الإلغاء' : 'Canceled',
                )
              }
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button>
          </div>
        ) : null}
      </section>

      <section className="oma-billing__notice">
        <h2>{isAr ? 'إثباتات الدفع' : 'Payment proofs'}</h2>
        <ul>
          {orders.map((o) => (
            <li key={String(o.id)}>
              {String(o.reference)} · {String(o.provider)} · {String(o.plan_code)} ·{' '}
              {String(o.status)}
              {o.proof_note ? ` · ${String(o.proof_note)}` : ''}
              <Button
                type="primary"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => adminReviewOrder(String(o.id), 'approve', note),
                    isAr ? 'تمت الموافقة' : 'Approved',
                  )
                }
              >
                {isAr ? 'موافقة' : 'Approve'}
              </Button>
              <Button
                disabled={busy}
                onClick={() =>
                  void run(
                    () => adminReviewOrder(String(o.id), 'reject', note),
                    isAr ? 'تم الرفض' : 'Rejected',
                  )
                }
              >
                {isAr ? 'رفض' : 'Reject'}
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
