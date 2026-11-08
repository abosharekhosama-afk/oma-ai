'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  adminOrderReceipt,
  adminReviewOrder,
  adminUpdateSettings,
  planErrorFromUnknown,
  type ManualOrderDto,
} from '../../../../../lib/billing-api';
import '../../billing/billing.css';

const STATUS_FILTERS = [
  'all',
  'awaiting_payment',
  'proof_uploaded',
  'approved',
  'rejected',
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number];

function formatUsd(cents?: number | null) {
  if (cents == null) return '—';
  return `$${(cents / 100).toFixed(2)}`;
}

export default function AdminBillingClient() {
  const isAr = useLocale() === 'ar';
  const toast = useToast();
  const caps = useCapabilities();
  const [allowed, setAllowed] = useState<boolean | null>(
    caps.can('platform.support.access') ? true : null,
  );
  const [q, setQ] = useState('');
  const [workspaces, setWorkspaces] = useState<Array<Record<string, unknown>>>([]);
  const [orders, setOrders] = useState<ManualOrderDto[]>([]);
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [selected, setSelected] = useState('');
  const [plan, setPlan] = useState('pro');
  const [note, setNote] = useState('');
  const [reference, setReference] = useState('');
  const [days, setDays] = useState('30');
  const [vat, setVat] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [receipts, setReceipts] = useState<Record<string, string>>({});
  const [previewId, setPreviewId] = useState<string | null>(null);
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
      if (s.data?.vatRateBps != null) setVat(String(Number(s.data.vatRateBps) / 100));
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

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'all') return orders;
    return orders.filter((order) => order.status === statusFilter);
  }, [orders, statusFilter]);

  const statusLabel = (status: string) => {
    const map: Record<string, { en: string; ar: string }> = {
      all: { en: 'All', ar: 'الكل' },
      awaiting_payment: { en: 'Awaiting payment', ar: 'بانتظار الدفع' },
      proof_uploaded: { en: 'Proof uploaded', ar: 'تم رفع الإشعار' },
      approved: { en: 'Approved', ar: 'موافق عليه' },
      rejected: { en: 'Rejected', ar: 'مرفوض' },
      cancelled: { en: 'Cancelled', ar: 'ملغى' },
    };
    return isAr ? (map[status]?.ar ?? status) : (map[status]?.en ?? status);
  };

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

  async function previewReceipt(id: string) {
    if (receipts[id]) {
      setPreviewId(id);
      return;
    }
    setBusy(true);
    try {
      const res = await adminOrderReceipt(id);
      setReceipts((prev) => ({ ...prev, [id]: res.data.image_data_url }));
      setPreviewId(id);
    } catch (err) {
      toast.push(
        planErrorFromUnknown(err, isAr) ||
          (err instanceof Error ? err.message : null) ||
          (isAr ? 'تعذر عرض الإشعار' : 'Could not open the receipt'),
        'danger',
      );
    } finally {
      setBusy(false);
    }
  }

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

  return (
    <main className="oma-planable-page oma-billing" dir={isAr ? 'rtl' : 'ltr'}>
      <header className="oma-planable-page__header oma-billing__header">
        <div>
          <h1 className="oma-planable-page__title">{isAr ? 'فوترة المنصة' : 'Platform billing'}</h1>
          <p className="oma-planable-page__sub">
            {isAr
              ? 'تفعيل الاشتراكات يدوياً، مراجعة إشعارات التحويل، وتعديل نسبة الضريبة.'
              : 'Manually activate subscriptions, review transfer receipts, and edit the VAT rate.'}
          </p>
        </div>
      </header>

      <section className="oma-billing__card oma-billing__admin-panel">
        <h2>{isAr ? 'إعدادات الضريبة' : 'VAT settings'}</h2>
        <p className="oma-billing__desc">
          {isAr
            ? 'تُحسب الأسعار في واجهة الخطط وعند الدفع من هذه النسبة، وليست ثابتة في الواجهة.'
            : 'Plan prices and checkout totals use this rate. It is not hard-coded in the UI.'}
        </p>
        <label className="oma-billing__field">
          <span>{isAr ? 'نسبة الضريبة %' : 'VAT %'}</span>
          <input
            value={vat}
            onChange={(e) => setVat(e.target.value)}
            inputMode="decimal"
            placeholder={isAr ? 'من الإعدادات' : 'From settings'}
          />
        </label>
        <Button
          type="primary"
          disabled={busy || vat.trim() === '' || !Number.isFinite(Number(vat))}
          onClick={() =>
            void run(
              () => adminUpdateSettings({ vat_rate_bps: Math.round(Number(vat) * 100) }),
              isAr ? 'تم حفظ الضريبة' : 'VAT saved',
            )
          }
        >
          {isAr ? 'حفظ الضريبة' : 'Save VAT'}
        </Button>
        <p className="oma-billing__desc">
          {isAr ? 'المهلة الحالية' : 'Current grace'}: {String(settings.gracePeriodDays ?? 7)}{' '}
          {isAr ? 'يوماً' : 'days'}
        </p>
      </section>

      <section className="oma-billing__card oma-billing__admin-panel">
        <h2>{isAr ? 'مساحات العمل' : 'Workspaces'}</h2>
        <label className="oma-billing__field">
          <span>{isAr ? 'بحث' : 'Search'}</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={isAr ? 'الاسم أو المعرف' : 'Name or slug'}
          />
        </label>
        <div className="oma-billing__workspace-grid">
          {workspaces.map((w) => (
            <button
              key={String(w.id)}
              type="button"
              className={`oma-billing__workspace-card${selected === String(w.id) ? ' is-selected' : ''}`}
              onClick={() => setSelected(String(w.id))}
            >
              <strong>{String(w.name)}</strong>
              <span>{String(w.slug)}</span>
              <em>
                {String(w.plan_code ?? '—')} · {String(w.status ?? '—')}
              </em>
            </button>
          ))}
        </div>
        {selected ? (
          <div className="oma-billing__admin-actions">
            <p>
              {isAr ? 'المحدد' : 'Selected'}: {selected}
            </p>
            <label className="oma-billing__field">
              <span>{isAr ? 'الخطة' : 'Plan'}</span>
              <select value={plan} onChange={(e) => setPlan(e.target.value)}>
                <option value="starter">{isAr ? 'البداية' : 'Starter'}</option>
                <option value="pro">{isAr ? 'الاحترافية' : 'Pro'}</option>
                <option value="agency">{isAr ? 'الوكالة' : 'Agency'}</option>
              </select>
            </label>
            <label className="oma-billing__field">
              <span>{isAr ? 'المرجع / الإيصال' : 'Reference / receipt'}</span>
              <input value={reference} onChange={(e) => setReference(e.target.value)} />
            </label>
            <label className="oma-billing__field">
              <span>{isAr ? 'أيام التمديد' : 'Extend days'}</span>
              <input value={days} onChange={(e) => setDays(e.target.value)} />
            </label>
            <label className="oma-billing__field">
              <span>{isAr ? 'ملاحظة' : 'Note'}</span>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            <div className="oma-billing__admin-row">
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
          </div>
        ) : null}
      </section>

      <section className="oma-billing__admin-panel">
        <h2>{isAr ? 'طلبات التحويل اليدوي' : 'Manual payment orders'}</h2>
        <div
          className="oma-billing__filters"
          role="tablist"
          aria-label={isAr ? 'تصفية الحالة' : 'Filter by status'}
        >
          {STATUS_FILTERS.map((status) => (
            <button
              key={status}
              type="button"
              role="tab"
              aria-selected={statusFilter === status}
              className={statusFilter === status ? 'is-active' : ''}
              onClick={() => setStatusFilter(status)}
            >
              {statusLabel(status)}
            </button>
          ))}
        </div>
        <div className="oma-billing__orders">
          {filteredOrders.length ? (
            filteredOrders.map((order) => (
              <article key={order.id} className={`oma-billing__order is-${order.status}`}>
                <header className="oma-billing__order-head">
                  <div>
                    <strong>{order.reference}</strong>
                    <p>
                      {order.provider} · {order.plan_code} · {statusLabel(order.status)}
                    </p>
                  </div>
                  <span>{formatUsd(order.amount_inc_vat_cents)}</span>
                </header>
                <dl className="oma-billing__order-meta">
                  <div>
                    <dt>{isAr ? 'المحوِّل' : 'Sender'}</dt>
                    <dd>{order.transfer_sender_name || '—'}</dd>
                  </div>
                  <div>
                    <dt>{isAr ? 'الهاتف / الحساب' : 'Phone / account'}</dt>
                    <dd>{order.transfer_contact || '—'}</dd>
                  </div>
                  <div>
                    <dt>{isAr ? 'المبلغ المحوَّل' : 'Transferred'}</dt>
                    <dd>{formatUsd(order.transfer_amount_cents)}</dd>
                  </div>
                  <div>
                    <dt>{isAr ? 'التاريخ' : 'Date'}</dt>
                    <dd>{order.transfer_at ? order.transfer_at.slice(0, 10) : '—'}</dd>
                  </div>
                  <div>
                    <dt>{isAr ? 'مرجع المعاملة' : 'Transaction ref'}</dt>
                    <dd>{order.transfer_txn_ref || '—'}</dd>
                  </div>
                  <div>
                    <dt>{isAr ? 'مساحة العمل' : 'Workspace'}</dt>
                    <dd>{order.tenant_id || '—'}</dd>
                  </div>
                </dl>
                {order.proof_note ? <p className="oma-billing__desc">{order.proof_note}</p> : null}
                <div className="oma-billing__admin-row">
                  {order.has_proof_image ? (
                    <Button disabled={busy} onClick={() => void previewReceipt(order.id)}>
                      {isAr ? 'عرض الإشعار' : 'View receipt'}
                    </Button>
                  ) : (
                    <span className="oma-billing__desc">
                      {isAr ? 'لا توجد صورة إشعار' : 'No receipt image'}
                    </span>
                  )}
                </div>
                {previewId === order.id && receipts[order.id] ? (
                  <figure className="oma-billing__receipt-preview">
                    <img
                      src={receipts[order.id]}
                      alt={isAr ? 'صورة إشعار التحويل' : 'Transfer receipt'}
                    />
                  </figure>
                ) : null}
                {order.status === 'awaiting_payment' || order.status === 'proof_uploaded' ? (
                  <>
                    <label className="oma-billing__field">
                      <span>{isAr ? 'ملاحظة الموافقة أو الرفض' : 'Approve or reject note'}</span>
                      <textarea
                        value={reviewNotes[order.id] ?? ''}
                        onChange={(e) =>
                          setReviewNotes((prev) => ({ ...prev, [order.id]: e.target.value }))
                        }
                      />
                    </label>
                    <div className="oma-billing__admin-row">
                      <Button
                        type="primary"
                        disabled={busy}
                        onClick={() =>
                          void run(
                            () => adminReviewOrder(order.id, 'approve', reviewNotes[order.id]),
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
                            () => adminReviewOrder(order.id, 'reject', reviewNotes[order.id]),
                            isAr ? 'تم الرفض' : 'Rejected',
                          )
                        }
                      >
                        {isAr ? 'رفض' : 'Reject'}
                      </Button>
                    </div>
                  </>
                ) : null}
              </article>
            ))
          ) : (
            <p className="oma-billing__desc">
              {isAr ? 'لا توجد طلبات في هذا التصفية.' : 'No orders match this filter.'}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
