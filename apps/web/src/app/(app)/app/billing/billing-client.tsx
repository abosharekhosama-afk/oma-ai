'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@oma/ui/controls';
import { useLocale } from '../../../../lib/use-locale';
import { useToast } from '../../../../components/ui/toast';
import { useCapabilities } from '../../../../lib/use-capabilities';
import {
  changePlan,
  getSubscription,
  listPlans,
  requestUpgrade,
  type PlanDto,
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
  if (code === 'free') return <SparkleIcon />;
  if (code === 'pro') return <CrownIcon />;
  return <BriefcaseIcon />;
}

function formatLimit(key: string, value: number | null, isAr: boolean): string {
  if (value == null) return isAr ? 'غير محدود' : 'Unlimited';
  if (key === 'storage_bytes') {
    const gb = value / (1024 * 1024 * 1024);
    return `${gb % 1 === 0 ? gb : gb.toFixed(1)} GB`;
  }
  return String(value);
}

const LIMIT_LABELS: Record<string, { en: string; ar: string }> = {
  brands: { en: 'Brands', ar: 'العلامات' },
  social_channels: { en: 'Social channels', ar: 'القنوات الاجتماعية' },
  seats: { en: 'Team seats', ar: 'مقاعد الفريق' },
  guests: { en: 'Guests / clients', ar: 'الضيوف / العملاء' },
  posts_per_month: { en: 'Posts / month', ar: 'منشورات / شهر' },
  posts_total: { en: 'Posts (total)', ar: 'منشورات (إجمالي)' },
  storage_bytes: { en: 'Work Drive storage', ar: 'تخزين مساحة العمل' },
  approval_level: { en: 'Approval level', ar: 'مستوى الموافقات' },
  ai_runs_per_month: { en: 'AI assists / month', ar: 'مساعدات ذكاء / شهر' },
};

const FEATURE_LABELS: Record<string, { en: string; ar: string }> = {
  feed_view: { en: 'Feed view', ar: 'عرض الخلاصة' },
  calendar_view: { en: 'Calendar view', ar: 'عرض التقويم' },
  grid_view: { en: 'Grid view', ar: 'عرض الشبكة' },
  list_view: { en: 'List view', ar: 'عرض القائمة' },
  approvals_optional: { en: 'Optional approvals', ar: 'موافقات اختيارية' },
  approvals_required: { en: 'Required approvals', ar: 'موافقات إلزامية' },
  approvals_multi_level: { en: 'Multi-level approvals', ar: 'موافقات متعددة المستويات' },
  client_visibility: { en: 'Hide from clients', ar: 'إخفاء عن العملاء' },
  analytics: { en: 'Analytics', ar: 'التحليلات' },
  custom_roles: { en: 'Custom roles', ar: 'أدوار مخصصة' },
  publishing: { en: 'Publishing', ar: 'النشر' },
  ai_assist: { en: 'AI assist', ar: 'مساعد الذكاء الاصطناعي' },
  workdrive: { en: 'Work Drive', ar: 'مساحة العمل' },
};

export default function BillingClient() {
  const isAr = useLocale() === 'ar';
  const toast = useToast();
  const caps = useCapabilities();
  const [annual, setAnnual] = useState(false);
  const [plans, setPlans] = useState<PlanDto[]>([]);
  const [sub, setSub] = useState<SubscriptionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, s] = await Promise.all([listPlans(), getSubscription()]);
      setPlans(p.data ?? []);
      setSub(s.data);
    } catch {
      toast.push(isAr ? 'تعذر تحميل الخطط' : 'Could not load plans', 'danger');
    } finally {
      setLoading(false);
    }
  }, [isAr, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const copy = isAr
    ? {
        title: 'الخطط والأسعار',
        sub: 'اختر الخطة المناسبة لفريقك. الدفع قريباً — يمكنك طلب ترقية الآن.',
        current: 'الخطة الحالية',
        choose: 'طلب ترقية',
        contact: 'تواصل مع المبيعات',
        back: 'العودة',
        note: 'الدفع الإلكتروني غير مفعّل بعد. طلب الترقية يُراجع من مسؤول مساحة العمل، ويمكن للمسؤول تطبيق الخطة يدوياً.',
        monthly: 'شهرياً',
        yearly: 'سنوياً',
        save: 'وفر',
        usage: 'الاستخدام والخطة',
        apply: 'تطبيق الخطة',
        applied: 'تم تطبيق الخطة',
        requested: 'تم إرسال طلب الترقية',
        coming: 'الدفع قريباً',
      }
    : {
        title: 'Plans & pricing',
        sub: 'Choose the plan that fits your team. Payment is coming soon — request an upgrade anytime.',
        current: 'Current plan',
        choose: 'Request upgrade',
        contact: 'Contact sales',
        back: 'Back',
        note: 'Online payments are not enabled yet. Upgrade requests are reviewed by a workspace admin, who can apply a plan manually.',
        monthly: 'per month',
        yearly: 'per month, billed yearly',
        save: 'Save',
        usage: 'Usage & plan',
        apply: 'Apply plan',
        applied: 'Plan applied',
        requested: 'Upgrade request sent',
        coming: 'Payment coming soon',
      };

  async function onUpgrade(code: string) {
    setBusy(code);
    try {
      if (caps.can('tenant.manage') && code !== 'enterprise') {
        await changePlan({
          plan_code: code,
          billing_cycle: annual ? 'yearly' : 'monthly',
          notes: 'Applied from pricing page (payment deferred)',
        });
        toast.push(copy.applied, 'success');
      } else {
        await requestUpgrade({
          plan_code: code,
          billing_cycle: annual ? 'yearly' : 'monthly',
        });
        toast.push(copy.requested, 'success');
      }
      await load();
    } catch {
      toast.push(isAr ? 'تعذر إكمال الطلب' : 'Could not complete the request', 'danger');
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="oma-planable-page oma-billing" dir={isAr ? 'rtl' : 'ltr'}>
      <header className="oma-planable-page__header oma-billing__header">
        <div>
          <h1 className="oma-planable-page__title">{copy.title}</h1>
          <p className="oma-planable-page__sub">{copy.sub}</p>
        </div>
        <div className="oma-billing__header-actions">
          <Link
            className="oma-billing__icon-link"
            href="/app/subscription"
            aria-label={copy.usage}
            title={copy.usage}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M4 19V5M4 19h16M8 17V9M12 17V7M16 17v-4" />
            </svg>
          </Link>
          <Link
            className="oma-billing__icon-link"
            href="/app"
            aria-label={copy.back}
            title={copy.back}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d={isAr ? 'M5 12h14M11 6l-6 6 6 6' : 'M19 12H5M11 6l-6 6 6 6'} />
            </svg>
          </Link>
        </div>
      </header>

      <div className="oma-billing__notice" role="status">
        <strong>{copy.coming}</strong> — {copy.note}
      </div>

      <div
        className="oma-billing__switch"
        role="group"
        aria-label={isAr ? 'دورة الفوترة' : 'Billing cycle'}
      >
        <button
          type="button"
          className={!annual ? 'is-active' : ''}
          onClick={() => setAnnual(false)}
        >
          {isAr ? 'شهري' : 'Monthly'}
        </button>
        <button type="button" className={annual ? 'is-active' : ''} onClick={() => setAnnual(true)}>
          {isAr ? 'سنوي' : 'Yearly'} <span>{copy.save} 20%</span>
        </button>
      </div>

      {loading ? (
        <p className="oma-billing__desc">{isAr ? 'جاري التحميل…' : 'Loading…'}</p>
      ) : (
        <section className="oma-billing__grid" aria-label={copy.title}>
          {plans.map((plan) => {
            const active = sub?.plan_code === plan.code;
            const price =
              plan.price_monthly_usd == null
                ? null
                : annual
                  ? plan.price_yearly_per_month_usd
                  : plan.price_monthly_usd;
            const featureKeys = Object.entries(plan.features)
              .filter(([, on]) => on)
              .map(([k]) => k);
            const limitKeys = [
              'brands',
              'social_channels',
              'seats',
              'guests',
              'posts_per_month',
              'posts_total',
              'storage_bytes',
            ].filter(
              (k) =>
                plan.limits[k] !== undefined &&
                !(k === 'posts_total' && plan.limits[k] == null) &&
                !(k === 'posts_per_month' && plan.code === 'free'),
            );
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
                  {price == null ? (
                    <strong>{isAr ? 'حسب الطلب' : 'Custom'}</strong>
                  ) : (
                    <>
                      <strong>${price}</strong>
                      <span> / {annual ? copy.yearly : copy.monthly}</span>
                    </>
                  )}
                </div>
                <p className="oma-billing__included">{isAr ? 'الحدود' : 'Limits'}</p>
                <ul>
                  {limitKeys.map((key) => (
                    <li key={key}>
                      <CheckIcon aria-hidden="true" />
                      {(isAr ? LIMIT_LABELS[key]?.ar : LIMIT_LABELS[key]?.en) ?? key}:{' '}
                      {formatLimit(key, plan.limits[key] ?? null, isAr)}
                    </li>
                  ))}
                </ul>
                <p className="oma-billing__included">{isAr ? 'الميزات' : 'Features'}</p>
                <ul>
                  {featureKeys.slice(0, 8).map((key) => (
                    <li key={key}>
                      <CheckIcon aria-hidden="true" />
                      {(isAr ? FEATURE_LABELS[key]?.ar : FEATURE_LABELS[key]?.en) ?? key}
                    </li>
                  ))}
                </ul>
                <Button
                  type={active ? 'default' : 'primary'}
                  disabled={active || busy === plan.code}
                  onClick={() => void onUpgrade(plan.code)}
                >
                  {active ? copy.current : plan.code === 'enterprise' ? copy.contact : copy.choose}
                </Button>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
