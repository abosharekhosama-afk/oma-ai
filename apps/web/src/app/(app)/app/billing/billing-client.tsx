'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@oma/ui/controls';
import { useLocale } from '../../../../lib/use-locale';
import { useToast } from '../../../../components/ui/toast';
import { useCapabilities } from '../../../../lib/use-capabilities';
import {
  openBillingPortal,
  getSubscription,
  listPlans,
  startCheckout,
  submitPaymentProof,
  planErrorFromUnknown,
  type PlanDto,
  type ProviderDto,
  type SubscriptionView,
} from '../../../../lib/billing-api';
import {
  BriefcaseIcon,
  CheckIcon,
  CrownIcon,
  SparkleIcon,
} from '../../../../components/ui/plx-icons';
import './billing.css';

const RECEIPT_MAX_BYTES = 4 * 1024 * 1024;
const RECEIPT_ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function planIcon(code: string) {
  if (code === 'starter') return <SparkleIcon />;
  if (code === 'pro') return <CrownIcon />;
  return <BriefcaseIcon />;
}

const LIMIT_KEYS = [
  'brands',
  'social_accounts',
  'seats',
  'scheduled_posts_per_month',
  'ai_credits_per_month',
  'listening_keywords',
  'mentions_per_month',
];

const LIMIT_LABELS: Record<string, { en: string; ar: string }> = {
  brands: { en: 'Brands', ar: 'العلامات' },
  social_accounts: { en: 'Social accounts', ar: 'الحسابات الاجتماعية' },
  seats: { en: 'Team seats', ar: 'مقاعد الفريق' },
  scheduled_posts_per_month: { en: 'Scheduled posts / period', ar: 'منشورات مجدولة / فترة' },
  ai_credits_per_month: { en: 'AI credits / period', ar: 'رصيد ذكاء / فترة' },
  listening_keywords: { en: 'Listening keywords', ar: 'كلمات الاستماع' },
  mentions_per_month: { en: 'Mentions / period', ar: 'إشارات / فترة' },
};

type PendingOrder = {
  id?: string;
  reference?: string;
  provider?: string;
  instructions?: { en: string; ar: string };
  message?: { en: string; ar: string };
  amount_inc_vat_cents?: number;
  vat_percent?: string;
  status?: string;
};

type TransferForm = {
  sender_name: string;
  contact: string;
  amount: string;
  transfer_date: string;
  txn_ref: string;
  preview: string;
  file_name: string;
  mime: string;
};

function todayInputDate() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function emptyTransfer(amount = ''): TransferForm {
  return {
    sender_name: '',
    contact: '',
    amount,
    transfer_date: todayInputDate(),
    txn_ref: '',
    preview: '',
    file_name: '',
    mime: '',
  };
}

function formatUsd(cents?: number | null) {
  if (cents == null) return null;
  return `$${(cents / 100).toFixed(2)}`;
}

function money(n: number) {
  return `$${Number(n).toFixed(n % 1 === 0 ? 0 : 2)}`;
}

export default function BillingClient() {
  const isAr = useLocale() === 'ar';
  const toast = useToast();
  const caps = useCapabilities();
  const canBill = caps.can('billing.manage') || caps.can('platform.support.access');
  const canOpenAdmin = caps.can('platform.support.access');
  const [annual, setAnnual] = useState(false);
  const [plans, setPlans] = useState<PlanDto[]>([]);
  const [sub, setSub] = useState<SubscriptionView | null>(null);
  const [xAddon, setXAddon] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<PlanDto | null>(null);
  const [checkoutStep, setCheckoutStep] = useState<'providers' | 'manual' | 'pending'>('providers');
  const [pendingOrder, setPendingOrder] = useState<PendingOrder | null>(null);
  const [transfer, setTransfer] = useState<TransferForm>(emptyTransfer());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, s] = await Promise.all([listPlans(), getSubscription()]);
      setPlans(p.data ?? []);
      setSub(s.data);
      setXAddon(Boolean(s.data.x_api_addon));
      setPendingOrder((prev) => {
        if (prev) return prev;
        const existing = s.data.pending_manual_orders?.[0];
        if (!existing) return prev;
        return {
          id: existing.id,
          reference: existing.reference,
          provider: existing.provider,
          instructions: existing.instructions,
          amount_inc_vat_cents: existing.amount_inc_vat_cents,
          vat_percent: existing.vat_percent,
          status: existing.status,
        };
      });
    } catch {
      toast.push(isAr ? 'تعذر تحميل الخطط' : 'Could not load plans', 'danger');
    } finally {
      setLoading(false);
    }
  }, [isAr, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!checkoutOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) setCheckoutOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, checkoutOpen]);

  const providers: ProviderDto[] = (sub?.providers ?? []).filter((item) => item.configured);
  const catalogVat = plans[0]?.vat_percent ?? sub?.settings_vat_percent;
  const addonPrice = sub?.addon?.price_monthly_usd;
  const addonInc = formatUsd(sub?.addon?.monthly_vat?.inc_vat_cents);

  const checkoutTitle = useMemo(() => {
    if (!checkoutPlan) return isAr ? 'اختيار طريقة الدفع' : 'Choose a payment method';
    const name = isAr ? checkoutPlan.name.ar : checkoutPlan.name.en;
    return isAr ? `الدفع لخطة ${name}` : `Pay for ${name}`;
  }, [checkoutPlan, isAr]);

  function closeCheckout() {
    if (busy) return;
    setCheckoutOpen(false);
    setCheckoutStep('providers');
    setCheckoutPlan(null);
  }

  function openCheckout(plan: PlanDto) {
    if (!canBill) {
      toast.push(
        isAr
          ? 'فقط المالك أو دور الفوترة يمكنه تغيير الخطة'
          : 'Only the owner or billing role can change the plan',
        'danger',
      );
      return;
    }
    setCheckoutPlan(plan);
    setCheckoutStep('providers');
    setCheckoutOpen(true);
  }

  async function checkoutWithProvider(item: ProviderDto) {
    if (!checkoutPlan) return;
    setBusy(item.id);
    try {
      const result = await startCheckout({
        plan_code: checkoutPlan.code,
        billing_cycle: annual ? 'yearly' : 'monthly',
        provider: item.id,
        x_api_addon: xAddon,
      });
      if (item.mode === 'live' || result.data.redirect_url) {
        if (result.data.redirect_url) {
          window.location.assign(result.data.redirect_url);
          return;
        }
        throw new Error(
          isAr ? 'تعذر فتح صفحة الدفع لدى المزود' : 'The provider did not return a payment page',
        );
      }
      const pending: PendingOrder = {
        id: result.data.order_id ?? result.data.id,
        reference: result.data.reference,
        provider: result.data.provider ?? item.id,
        instructions: result.data.instructions,
        message: result.data.message,
        amount_inc_vat_cents: result.data.amount_inc_vat_cents,
        vat_percent: result.data.vat_percent,
        status: result.data.status,
      };
      setPendingOrder(pending);
      setTransfer(
        emptyTransfer(
          result.data.amount_inc_vat_cents != null
            ? (result.data.amount_inc_vat_cents / 100).toFixed(2)
            : '',
        ),
      );
      setCheckoutStep('manual');
      toast.push(
        result.data.message
          ? isAr
            ? result.data.message.ar
            : result.data.message.en
          : isAr
            ? 'أدخل تفاصيل التحويل وارفع صورة الإشعار'
            : 'Enter the transfer details and upload a receipt',
        'success',
      );
    } catch (err) {
      toast.push(
        planErrorFromUnknown(err, isAr) ||
          (err instanceof Error ? err.message : null) ||
          (isAr ? 'تعذر إكمال طلب الترقية' : 'Could not complete the upgrade request'),
        'danger',
      );
    } finally {
      setBusy(null);
    }
  }

  async function onPortal() {
    setBusy('portal');
    try {
      const res = await openBillingPortal();
      if (res.data.redirect_url) window.location.assign(res.data.redirect_url);
    } catch (err) {
      toast.push(
        planErrorFromUnknown(err, isAr) ||
          (err instanceof Error ? err.message : null) ||
          (isAr ? 'تعذر فتح بوابة سترايب' : 'Could not open the Stripe portal'),
        'danger',
      );
    } finally {
      setBusy(null);
    }
  }

  function onReceiptFile(file: File | undefined) {
    if (!file) return;
    if (!RECEIPT_ALLOWED_MIME.includes(file.type)) {
      toast.push(
        isAr
          ? 'يجب أن تكون صورة الإشعار JPEG أو PNG أو WebP أو GIF'
          : 'Receipt must be a JPEG, PNG, WebP, or GIF image',
        'danger',
      );
      return;
    }
    if (file.size > RECEIPT_MAX_BYTES) {
      toast.push(
        isAr ? 'يجب ألا يتجاوز حجم الصورة 4 ميغابايت' : 'Receipt image must be 4 MB or smaller',
        'danger',
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setTransfer((prev) => ({
        ...prev,
        preview: String(reader.result || ''),
        file_name: file.name,
        mime: file.type,
      }));
    };
    reader.readAsDataURL(file);
  }

  async function onSubmitTransfer() {
    if (!pendingOrder?.reference && !pendingOrder?.id) {
      toast.push(isAr ? 'لا يوجد طلب دفع بعد' : 'No payment order yet', 'danger');
      return;
    }
    if (
      !transfer.sender_name.trim() ||
      !transfer.contact.trim() ||
      !transfer.amount.trim() ||
      !transfer.transfer_date ||
      !transfer.txn_ref.trim() ||
      !transfer.preview
    ) {
      toast.push(
        isAr
          ? 'أكمل تفاصيل التحويل وارفع صورة الإشعار'
          : 'Complete the transfer details and upload a receipt image',
        'danger',
      );
      return;
    }
    setBusy('proof');
    try {
      await submitPaymentProof({
        reference: pendingOrder.reference,
        order_id: pendingOrder.id,
        sender_name: transfer.sender_name,
        contact: transfer.contact,
        amount: transfer.amount,
        transfer_date: transfer.transfer_date,
        txn_ref: transfer.txn_ref,
        proof_file_name: transfer.file_name,
        proof_mime: transfer.mime,
        proof_image_base64: transfer.preview,
      });
      setPendingOrder((prev) => (prev ? { ...prev, status: 'proof_uploaded' } : prev));
      setCheckoutStep('pending');
      toast.push(
        isAr
          ? 'تم إرسال إثبات الدفع وهو بانتظار المراجعة'
          : 'Payment proof submitted and waiting for review',
        'success',
      );
      await load();
    } catch (err) {
      toast.push(
        planErrorFromUnknown(err, isAr) ||
          (err instanceof Error ? err.message : null) ||
          (isAr ? 'تعذر إرسال الإثبات' : 'Could not submit proof'),
        'danger',
      );
    } finally {
      setBusy(null);
    }
  }

  if (!loading && sub?.viewer_is_platform_admin) {
    return (
      <main className="oma-planable-page oma-billing" dir={isAr ? 'rtl' : 'ltr'}>
        <header className="oma-planable-page__header oma-billing__header">
          <div>
            <h1 className="oma-planable-page__title">
              {isAr ? 'فوترة المنصة' : 'Platform billing'}
            </h1>
            <p className="oma-planable-page__sub">
              {isAr
                ? 'هذا حساب مالك المنصة. لا تظهر هنا بطاقات خطط المستأجرين ولا عناصر تغيير الخطة. راجع طلبات الدفع وعدّل الضريبة من إدارة الفوترة.'
                : 'This is the platform-owner account. Tenant plan cards and plan-change controls are hidden here. Review payments and edit VAT from admin billing.'}
            </p>
          </div>
        </header>
        <section
          className="oma-billing__admin-hero"
          aria-label={isAr ? 'أدوات الإدارة' : 'Admin tools'}
        >
          <article className="oma-billing__card">
            <h2>{isAr ? 'إدارة التفعيل والمدفوعات' : 'Activation and payments'}</h2>
            <p className="oma-billing__desc">
              {isAr
                ? 'راجع إثباتات التحويل، وافق أو ارفض الطلبات، وفعّل خطط مساحات العمل يدوياً.'
                : 'Review transfer proofs, approve or reject orders, and activate workspace plans manually.'}
            </p>
            <Link className="oma-billing__icon-link" href="/app/admin/billing">
              {isAr ? 'فتح إدارة الفوترة' : 'Open admin billing'}
            </Link>
          </article>
          <article className="oma-billing__card">
            <h2>{isAr ? 'الضريبة والإعدادات' : 'VAT and settings'}</h2>
            <p className="oma-billing__desc">
              {isAr
                ? `نسبة الضريبة الحالية من الإعدادات: ${sub.settings_vat_percent ?? catalogVat ?? '—'}. تغييرها يحدّث أسعار الواجهة وعمليات الدفع فوراً.`
                : `Current VAT from settings: ${sub.settings_vat_percent ?? catalogVat ?? '—'}. Changing it updates listed prices and checkout immediately.`}
            </p>
            <div className="oma-billing__header-actions">
              <Link className="oma-billing__icon-link" href="/app/admin/billing">
                {isAr ? 'تعديل الضريبة' : 'Edit VAT'}
              </Link>
              <Link className="oma-billing__icon-link" href="/app/settings">
                {isAr ? 'إعدادات المساحة' : 'Workspace settings'}
              </Link>
            </div>
          </article>
        </section>
      </main>
    );
  }

  return (
    <main className="oma-planable-page oma-billing" dir={isAr ? 'rtl' : 'ltr'}>
      <header className="oma-planable-page__header oma-billing__header">
        <div>
          <h1 className="oma-planable-page__title">{isAr ? 'الخطط والدفع' : 'Plans & billing'}</h1>
          <p className="oma-planable-page__sub">
            {isAr
              ? 'الأسعار قبل الضريبة، ويظهر الإجمالي شامل الضريبة بحسب النسبة الحالية من الإعدادات.'
              : 'List prices are shown before VAT. Totals including VAT follow the current rate in billing settings.'}
          </p>
        </div>
        <div className="oma-billing__header-actions">
          <Link className="oma-billing__icon-link" href="/app/subscription">
            {isAr ? 'الاستخدام' : 'Usage'}
          </Link>
          {canOpenAdmin ? (
            <Link className="oma-billing__icon-link" href="/app/admin/billing">
              {isAr ? 'إدارة الفوترة' : 'Admin billing'}
            </Link>
          ) : null}
        </div>
      </header>

      {sub ? (
        <div className="oma-billing__notice" role="status">
          <strong>
            {isAr ? sub.plan.name.ar : sub.plan.name.en} · {sub.status}
          </strong>
          {catalogVat || sub.settings_vat_percent
            ? ` · ${isAr ? 'الضريبة' : 'VAT'} ${catalogVat ?? sub.settings_vat_percent}`
            : null}
          {sub.grace_period_ends_at && sub.status === 'past_due'
            ? ` · ${isAr ? 'مهلة السماح حتى' : 'Grace until'} ${sub.grace_period_ends_at.slice(0, 10)}`
            : null}
          {sub.has_stripe_portal && canBill ? (
            <Button type="default" disabled={busy === 'portal'} onClick={() => void onPortal()}>
              {isAr ? 'بوابة سترايب' : 'Stripe portal'}
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="oma-billing__switch" role="group">
        <button
          type="button"
          className={!annual ? 'is-active' : ''}
          onClick={() => setAnnual(false)}
        >
          {isAr ? 'شهري' : 'Monthly'}
        </button>
        <button type="button" className={annual ? 'is-active' : ''} onClick={() => setAnnual(true)}>
          {isAr ? 'سنوي' : 'Yearly'} <span>{isAr ? 'وفر شهرين' : '2 months free'}</span>
        </button>
      </div>

      <label className="oma-billing__addon">
        <input type="checkbox" checked={xAddon} onChange={(e) => setXAddon(e.target.checked)} />
        <span className="oma-billing__addon-copy">
          <strong>{isAr ? 'إضافة واجهة إكس المدفوعة' : 'Paid X API add-on'}</strong>
          <span className="oma-billing__addon-price">
            {addonPrice != null
              ? isAr
                ? `${addonPrice}$ / شهر قبل الضريبة${addonInc ? ` · ${addonInc} شامل الضريبة` : ''}`
                : `$${addonPrice}/mo before VAT${addonInc ? ` · ${addonInc} including VAT` : ''}`
              : isAr
                ? 'سعر الإضافة من إعدادات الفوترة'
                : 'Priced from billing settings'}
          </span>
          <span className="oma-billing__addon-help">
            {isAr
              ? 'تتيح ربط حساب إكس (تويتر) للنشر والاستماع. من دونها يُحظر ربط إكس لأن واجهة إكس مدفوعة.'
              : 'Unlocks connecting an X (Twitter) account for publishing and listening. Without it, connecting X is blocked because X API access is paid.'}
          </span>
        </span>
      </label>

      {loading ? (
        <p className="oma-billing__desc">{isAr ? 'جاري التحميل…' : 'Loading…'}</p>
      ) : (
        <section className="oma-billing__grid" aria-label={isAr ? 'الخطط' : 'Plans'}>
          {plans.map((plan) => {
            const active = sub?.plan_code === plan.code;
            const price = annual ? plan.price_yearly_per_month_usd : plan.price_monthly_usd;
            const vatBlock = annual ? plan.yearly_vat : plan.monthly_vat;
            return (
              <article
                key={plan.code}
                className={`oma-billing__card${active ? ' is-selected' : ''}${plan.popular ? ' is-popular' : ''}`}
              >
                {plan.popular ? (
                  <span className="oma-billing__badge">
                    {isAr ? 'الأكثر اختياراً' : 'Most popular'}
                  </span>
                ) : null}
                <div className={`oma-billing__plan-icon is-${plan.code}`}>
                  {planIcon(plan.code)}
                </div>
                <h2>{isAr ? plan.name.ar : plan.name.en}</h2>
                <p className="oma-billing__desc">
                  {isAr ? plan.description.ar : plan.description.en}
                </p>
                <div className="oma-billing__price">
                  <strong>{price != null ? money(price) : '—'}</strong>
                  <span>
                    {' '}
                    /{' '}
                    {annual
                      ? isAr
                        ? 'شهر عند الدفع سنوياً'
                        : 'mo, billed yearly'
                      : isAr
                        ? 'شهر'
                        : 'month'}
                  </span>
                </div>
                <p className="oma-billing__included">{isAr ? 'قبل الضريبة' : 'Before VAT'}</p>
                {vatBlock ? (
                  <p className="oma-billing__price-vat">
                    {isAr
                      ? `شامل الضريبة (${plan.vat_percent}): ${formatUsd(vatBlock.inc_vat_cents)}`
                      : `Including ${plan.vat_percent} VAT: ${formatUsd(vatBlock.inc_vat_cents)}`}
                  </p>
                ) : null}
                <ul>
                  {LIMIT_KEYS.map((key) => (
                    <li key={key}>
                      <CheckIcon aria-hidden="true" />
                      {(isAr ? LIMIT_LABELS[key]?.ar : LIMIT_LABELS[key]?.en) ?? key}:{' '}
                      {plan.limits[key] ?? '—'}
                    </li>
                  ))}
                </ul>
                <Button
                  type={active ? 'default' : 'primary'}
                  disabled={active || busy === plan.code || !canBill}
                  onClick={() => openCheckout(plan)}
                >
                  {active
                    ? isAr
                      ? 'الخطة الحالية'
                      : 'Current plan'
                    : isAr
                      ? 'ترقية أو تغيير'
                      : 'Upgrade or switch'}
                </Button>
              </article>
            );
          })}
        </section>
      )}

      {sub?.invoices?.length ? (
        <section className="oma-billing__notice" aria-label={isAr ? 'الفواتير' : 'Invoices'}>
          <h2>{isAr ? 'الفواتير' : 'Invoices'}</h2>
          <ul>
            {sub.invoices.map((inv) => (
              <li key={inv.id}>
                {inv.number || inv.id.slice(0, 8)} · {(inv.amount_inc_vat_cents / 100).toFixed(2)}{' '}
                {inv.currency.toUpperCase()} · {inv.status}
                {inv.hosted_url ? (
                  <>
                    {' '}
                    <a href={inv.hosted_url} target="_blank" rel="noreferrer">
                      {isAr ? 'عرض' : 'View'}
                    </a>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {pendingOrder && !checkoutOpen ? (
        <section className="oma-billing__notice" aria-live="polite">
          <h2>{isAr ? 'طلب دفع قيد المراجعة' : 'Pending payment'}</h2>
          {pendingOrder.reference ? (
            <p>
              <strong>{isAr ? 'رقم المرجع' : 'Reference'}:</strong> {pendingOrder.reference}
            </p>
          ) : null}
          <p>
            {pendingOrder.status === 'proof_uploaded'
              ? isAr
                ? 'تم رفع الإشعار وبانتظار موافقة الإدارة.'
                : 'Receipt uploaded and waiting for admin review.'
              : isAr
                ? 'أكمل تفاصيل التحويل وارفع صورة الإشعار.'
                : 'Finish the transfer details and upload a receipt.'}
          </p>
          <Button
            type="primary"
            onClick={() => {
              setCheckoutStep(pendingOrder.status === 'proof_uploaded' ? 'pending' : 'manual');
              setCheckoutOpen(true);
            }}
          >
            {isAr ? 'عرض التفاصيل' : 'View details'}
          </Button>
        </section>
      ) : null}

      {checkoutOpen ? (
        <div className="oma-billing__modal-backdrop" onClick={closeCheckout} role="presentation">
          <div
            className="oma-billing__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="oma-billing-checkout-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="oma-billing__modal-head">
              <h2 id="oma-billing-checkout-title">{checkoutTitle}</h2>
              <button type="button" className="oma-billing__modal-close" onClick={closeCheckout}>
                {isAr ? 'إغلاق' : 'Close'}
              </button>
            </div>

            {checkoutStep === 'providers' ? (
              <div className="oma-billing__provider-grid" role="list">
                {providers.length ? (
                  providers.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="listitem"
                      className="oma-billing__provider-card"
                      disabled={Boolean(busy)}
                      onClick={() => void checkoutWithProvider(item)}
                    >
                      <strong>{isAr ? item.name_ar : item.name_en}</strong>
                      <span>
                        {item.mode === 'live'
                          ? isAr
                            ? 'سيتم تحويلك إلى صفحة الدفع الآمنة.'
                            : 'You will be redirected to a secure checkout page.'
                          : isAr
                            ? 'تحويل يدوي: أدخل التفاصيل وارفع صورة الإشعار بعد إنشاء المرجع.'
                            : 'Manual transfer: enter details and upload a receipt after we create a reference.'}
                      </span>
                      <em>{isAr ? item.notes_ar : item.notes_en}</em>
                    </button>
                  ))
                ) : (
                  <p>{isAr ? 'لا توجد طرق دفع مهيأة.' : 'No payment methods are configured.'}</p>
                )}
              </div>
            ) : null}

            {checkoutStep === 'manual' || checkoutStep === 'pending' ? (
              <div>
                {pendingOrder?.reference ? (
                  <p className="oma-billing__notice" role="status">
                    <strong>{isAr ? 'رقم المرجع' : 'Reference'}:</strong> {pendingOrder.reference}
                    {pendingOrder.amount_inc_vat_cents != null
                      ? ` · ${isAr ? 'المبلغ مع الضريبة' : 'Amount including VAT'} ${formatUsd(pendingOrder.amount_inc_vat_cents)}${pendingOrder.vat_percent ? ` (${isAr ? 'الضريبة' : 'VAT'} ${pendingOrder.vat_percent})` : ''}`
                      : ''}
                  </p>
                ) : null}
                {pendingOrder?.instructions ? (
                  <p className="oma-billing__desc">
                    {isAr ? pendingOrder.instructions.ar : pendingOrder.instructions.en}
                  </p>
                ) : null}

                {checkoutStep === 'pending' ? (
                  <p className="oma-billing__notice" role="status">
                    {isAr
                      ? `طلبك قيد المراجعة بالمرجع ${pendingOrder?.reference ?? ''}.`
                      : `Your payment is pending review under ${pendingOrder?.reference ?? ''}.`}
                  </p>
                ) : (
                  <form
                    className="oma-billing__transfer"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void onSubmitTransfer();
                    }}
                  >
                    <label className="oma-billing__field">
                      <span>{isAr ? 'اسم المحوِّل' : 'Sender name'}</span>
                      <input
                        value={transfer.sender_name}
                        onChange={(e) =>
                          setTransfer((prev) => ({ ...prev, sender_name: e.target.value }))
                        }
                        required
                        autoComplete="name"
                      />
                    </label>
                    <label className="oma-billing__field">
                      <span>{isAr ? 'الهاتف أو رقم الحساب' : 'Phone or account'}</span>
                      <input
                        value={transfer.contact}
                        onChange={(e) =>
                          setTransfer((prev) => ({ ...prev, contact: e.target.value }))
                        }
                        required
                        autoComplete="tel"
                      />
                    </label>
                    <label className="oma-billing__field">
                      <span>{isAr ? 'المبلغ المحوَّل' : 'Amount transferred'}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={transfer.amount}
                        onChange={(e) =>
                          setTransfer((prev) => ({ ...prev, amount: e.target.value }))
                        }
                        required
                      />
                    </label>
                    <label className="oma-billing__field">
                      <span>{isAr ? 'تاريخ التحويل' : 'Transfer date'}</span>
                      <input
                        type="date"
                        value={transfer.transfer_date}
                        onChange={(e) =>
                          setTransfer((prev) => ({ ...prev, transfer_date: e.target.value }))
                        }
                        required
                      />
                    </label>
                    <label className="oma-billing__field">
                      <span>{isAr ? 'مرجع المعاملة' : 'Transaction reference'}</span>
                      <input
                        value={transfer.txn_ref}
                        onChange={(e) =>
                          setTransfer((prev) => ({ ...prev, txn_ref: e.target.value }))
                        }
                        required
                      />
                    </label>
                    <label className="oma-billing__field">
                      <span>{isAr ? 'صورة إشعار التحويل' : 'Receipt image'}</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={(e) => onReceiptFile(e.target.files?.[0])}
                        required={!transfer.preview}
                      />
                    </label>
                    {transfer.preview ? (
                      <figure className="oma-billing__receipt-preview">
                        <img
                          src={transfer.preview}
                          alt={isAr ? 'معاينة الإشعار' : 'Receipt preview'}
                        />
                      </figure>
                    ) : null}
                    <Button type="primary" htmlType="submit" disabled={busy === 'proof'}>
                      {isAr ? 'إرسال الإثبات' : 'Submit proof'}
                    </Button>
                  </form>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
