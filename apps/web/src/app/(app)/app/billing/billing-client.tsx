'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
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

export default function BillingClient() {
  const isAr = useLocale() === 'ar';
  const toast = useToast();
  const caps = useCapabilities();
  const canBill = caps.can('billing.manage') || caps.can('platform.support.access');
  const isOwner = caps.can('platform.support.access');
  const [annual, setAnnual] = useState(false);
  const [plans, setPlans] = useState<PlanDto[]>([]);
  const [sub, setSub] = useState<SubscriptionView | null>(null);
  const [provider, setProvider] = useState('');
  const [xAddon, setXAddon] = useState(false);
  const [proof, setProof] = useState('');
  const [proofRef, setProofRef] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [pendingOrder, setPendingOrder] = useState<{
    reference?: string;
    instructions?: { en: string; ar: string };
    message?: { en: string; ar: string };
    amount_inc_vat_cents?: number;
    vat_percent?: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, s] = await Promise.all([listPlans(), getSubscription()]);
      setPlans(p.data ?? []);
      setSub(s.data);
      setXAddon(Boolean(s.data.x_api_addon));
      const available = (s.data.providers ?? []).filter((item) => item.configured);
      if (available[0]) setProvider(available[0].id);
    } catch {
      toast.push(isAr ? 'تعذر تحميل الخطط' : 'Could not load plans', 'danger');
    } finally {
      setLoading(false);
    }
  }, [isAr, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const providers: ProviderDto[] = (sub?.providers ?? []).filter((item) => item.configured);

  async function onUpgrade(code: string) {
    if (!canBill) {
      toast.push(
        isAr
          ? 'فقط المالك أو دور الفوترة يمكنه تغيير الخطة'
          : 'Only the owner or billing role can change the plan',
        'danger',
      );
      return;
    }
    setBusy(code);
    try {
      const result = await startCheckout({
        plan_code: code,
        billing_cycle: annual ? 'yearly' : 'monthly',
        provider: provider || undefined,
        x_api_addon: xAddon,
      });
      if (result.data.redirect_url) {
        window.location.assign(result.data.redirect_url);
        return;
      }
      if (result.data.reference) setProofRef(result.data.reference);
      setPendingOrder({
        reference: result.data.reference,
        instructions: result.data.instructions,
        message: result.data.message,
        amount_inc_vat_cents: result.data.amount_inc_vat_cents,
        vat_percent: result.data.vat_percent,
      });
      toast.push(
        result.data.message
          ? isAr
            ? result.data.message.ar
            : result.data.message.en
          : isAr
            ? 'تم إنشاء طلب الدفع'
            : 'Checkout created',
        'success',
      );
      await load();
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

  async function onProof() {
    setBusy('proof');
    try {
      await submitPaymentProof({ reference: proofRef || undefined, proof_note: proof });
      toast.push(isAr ? 'تم إرسال إثبات الدفع' : 'Payment proof submitted', 'success');
      setProof('');
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

  return (
    <main className="oma-planable-page oma-billing" dir={isAr ? 'rtl' : 'ltr'}>
      <header className="oma-planable-page__header oma-billing__header">
        <div>
          <h1 className="oma-planable-page__title">{isAr ? 'الخطط والدفع' : 'Plans & billing'}</h1>
          <p className="oma-planable-page__sub">
            {isAr
              ? 'الأسعار قبل الضريبة. تُحسب الضريبة من الخادم عند الدفع.'
              : 'Prices are shown before VAT. Tax is calculated on the server at checkout.'}
          </p>
        </div>
        <div className="oma-billing__header-actions">
          <Link className="oma-billing__icon-link" href="/app/subscription">
            {isAr ? 'الاستخدام' : 'Usage'}
          </Link>
          {isOwner ? (
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
          {sub.vat_percent ? ` · ${isAr ? 'الضريبة' : 'VAT'} ${sub.vat_percent}` : null}
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

      {providers.length ? (
        <div
          className="oma-billing__switch"
          role="group"
          aria-label={isAr ? 'طريقة الدفع' : 'Payment method'}
        >
          {providers.map((item) => (
            <button
              key={item.id}
              type="button"
              className={provider === item.id ? 'is-active' : ''}
              disabled={!item.configured}
              onClick={() => setProvider(item.id)}
            >
              {isAr ? item.name_ar : item.name_en}
            </button>
          ))}
        </div>
      ) : null}

      <label className="oma-billing__notice">
        <input type="checkbox" checked={xAddon} onChange={(e) => setXAddon(e.target.checked)} />{' '}
        {isAr
          ? `إضافة واجهة إكس المدفوعة (${sub?.addon?.price_monthly_usd ?? 29}$ / شهر قبل الضريبة)`
          : `Paid X API add-on ($${sub?.addon?.price_monthly_usd ?? 29}/mo before VAT)`}
      </label>

      {loading ? (
        <p className="oma-billing__desc">{isAr ? 'جاري التحميل…' : 'Loading…'}</p>
      ) : (
        <section className="oma-billing__grid" aria-label={isAr ? 'الخطط' : 'Plans'}>
          {plans.map((plan) => {
            const active = sub?.plan_code === plan.code;
            const price = annual ? plan.price_yearly_per_month_usd : plan.price_monthly_usd;
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
                  <strong>${price}</strong>
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
                  onClick={() => void onUpgrade(plan.code)}
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

      {pendingOrder ? (
        <section className="oma-billing__notice" aria-live="polite">
          <h2>{isAr ? 'طلب الترقية' : 'Upgrade request'}</h2>
          <p>{isAr ? pendingOrder.message?.ar : pendingOrder.message?.en}</p>
          {pendingOrder.reference ? (
            <p>
              <strong>{isAr ? 'رقم المرجع' : 'Reference'}:</strong> {pendingOrder.reference}
            </p>
          ) : null}
          {pendingOrder.amount_inc_vat_cents != null ? (
            <p>
              <strong>{isAr ? 'المبلغ مع الضريبة' : 'Amount including VAT'}:</strong> $
              {(pendingOrder.amount_inc_vat_cents / 100).toFixed(2)}
              {pendingOrder.vat_percent
                ? ` (${isAr ? 'الضريبة' : 'VAT'} ${pendingOrder.vat_percent})`
                : ''}
            </p>
          ) : null}
          {pendingOrder.instructions ? (
            <p>{isAr ? pendingOrder.instructions.ar : pendingOrder.instructions.en}</p>
          ) : null}
        </section>
      ) : null}

      <section className="oma-billing__notice">
        <h2>{isAr ? 'إثبات تحويل يدوي' : 'Manual transfer proof'}</h2>
        <p>
          {isAr
            ? 'بعد التحويل البنكي أو عبر جوال باي / بال بي / ريفلكت، أدخل رقم المرجع وملاحظة الإثبات.'
            : 'After a bank transfer or Jawwal Pay / PalPay / Reflect payment, enter the reference and a proof note.'}
        </p>
        <input
          value={proofRef}
          onChange={(e) => setProofRef(e.target.value)}
          placeholder={isAr ? 'رقم المرجع' : 'Reference number'}
        />
        <textarea
          value={proof}
          onChange={(e) => setProof(e.target.value)}
          placeholder={isAr ? 'رقم التحويل أو تفاصيل الإثبات' : 'Transfer id or proof details'}
        />
        <Button
          type="primary"
          disabled={!canBill || !proof || busy === 'proof'}
          onClick={() => void onProof()}
        >
          {isAr ? 'إرسال الإثبات' : 'Submit proof'}
        </Button>
      </section>
    </main>
  );
}
