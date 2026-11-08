'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@oma/ui/controls';
import { useLocale } from '../../../../lib/use-locale';
import { useToast } from '../../../../components/ui/toast';
import { useCapabilities } from '../../../../lib/use-capabilities';
import {
  cancelSubscriptionAtPeriodEnd,
  getSubscription,
  listCheckouts,
  resumeSubscription,
  type CheckoutDto,
  type SubscriptionView,
} from '../../../../lib/billing-api';
import '../billing/billing.css';

const BAR_LABELS: Record<string, { en: string; ar: string }> = {
  brands: { en: 'Brands', ar: 'العلامات' },
  social_channels: { en: 'Social channels', ar: 'القنوات الاجتماعية' },
  seats: { en: 'Team seats', ar: 'مقاعد الفريق' },
  social_accounts: { en: 'Social accounts', ar: 'الحسابات الاجتماعية' },
  guests: { en: 'Guests / clients', ar: 'الضيوف / العملاء' },
  scheduled_posts_per_month: { en: 'Scheduled posts', ar: 'منشورات مجدولة' },
  posts_per_month: { en: 'Scheduled posts', ar: 'منشورات مجدولة' },
  ai_credits_per_month: { en: 'AI credits', ar: 'رصيد الذكاء' },
  storage_bytes: { en: 'Work Drive storage', ar: 'تخزين مساحة العمل' },
  approval_level: { en: 'Approval level', ar: 'مستوى الموافقات' },
  listening_keywords: { en: 'Listening keywords', ar: 'كلمات الاستماع' },
  mentions_per_month: { en: 'Mentions', ar: 'الإشارات' },
  ai_runs_per_month: { en: 'AI credits', ar: 'رصيد الذكاء' },
};

function formatUsed(key: string, used: number, limit: number | null, isAr: boolean) {
  if (key === 'storage_bytes') {
    const toGb = (n: number) => {
      const gb = n / (1024 * 1024 * 1024);
      return `${gb < 0.1 && n > 0 ? gb.toFixed(2) : gb.toFixed(1)} GB`;
    };
    return limit == null ? toGb(used) : `${toGb(used)} / ${toGb(limit)}`;
  }
  if (limit == null) return `${used} · ${isAr ? 'غير محدود' : 'Unlimited'}`;
  return `${used} / ${limit}`;
}

export default function SubscriptionClient() {
  const isAr = useLocale() === 'ar';
  const toast = useToast();
  const caps = useCapabilities();
  const canAdmin = caps.can('billing.manage') || caps.can('platform.support.access');
  const [sub, setSub] = useState<SubscriptionView | null>(null);
  const [checkouts, setCheckouts] = useState<CheckoutDto[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await getSubscription();
      setSub(s.data);
      const check = await listCheckouts().catch(() => ({ data: [] as CheckoutDto[] }));
      setCheckouts(check.data ?? []);
    } catch {
      toast.push(isAr ? 'تعذر تحميل الاشتراك' : 'Could not load subscription', 'danger');
    } finally {
      setLoading(false);
    }
  }, [canAdmin, isAr, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const copy = isAr
    ? {
        title: 'الاشتراك والاستخدام',
        sub: 'تابع استخدامك مقارنة بحدود خطتك الحالية.',
        pricing: 'الخطط والأسعار',
        back: 'العودة',
        current: 'الخطة الحالية',
        deferred: 'غيّر خطتك وادفع من صفحة الفوترة. الحدود تُطبَّق على الخادم.',
        grandfather: 'مساحة العمل هذه على خطة مرحّلة من قبل التفعيل.',
        loading: 'جاري التحميل…',
      }
    : {
        title: 'Subscription & usage',
        sub: 'See how your workspace usage compares to your plan limits.',
        pricing: 'Plans & pricing',
        back: 'Back',
        current: 'Current plan',
        deferred: 'Change plans and pay from the billing page. Limits are enforced on the server.',
        grandfather: 'This workspace was grandfathered onto this plan at rollout.',
        loading: 'Loading…',
      };

  const bars = (sub?.usage_bars ?? []).filter((b) => {
    if (b.key === 'approval_level') return false;
    if (sub?.plan_code === 'free' && b.key === 'posts_per_month') return false;
    if (sub?.plan_code !== 'free' && b.key === 'posts_total') return false;
    return true;
  });

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
            href="/app/billing"
            aria-label={copy.pricing}
            title={copy.pricing}
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
              <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
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
        {copy.deferred}
      </div>

      {loading || !sub ? (
        <p>{copy.loading}</p>
      ) : (
        <>
          <section className="oma-sub__current" aria-label={copy.current}>
            <h2>
              {copy.current}: {isAr ? sub.plan.name.ar : sub.plan.name.en}
            </h2>
            <p className="oma-billing__desc">
              {isAr ? sub.plan.description.ar : sub.plan.description.en}
            </p>
            {sub.grandfathered ? <p className="oma-billing__desc">{copy.grandfather}</p> : null}
            {sub.current_period_end ? (
              <p className="oma-billing__desc">
                {isAr ? 'نهاية الفترة' : 'Period ends'}: {sub.current_period_end.slice(0, 10)}
                {sub.cancel_at_period_end
                  ? isAr
                    ? ' — سيُلغى في نهاية الفترة'
                    : ' — cancels at period end'
                  : ''}
              </p>
            ) : null}
            {sub.pending_plan_code ? (
              <p className="oma-billing__desc">
                {isAr ? 'بانتظار الدفع للخطة' : 'Awaiting payment for'}: {sub.pending_plan_code}
              </p>
            ) : null}
            {canAdmin ? (
              <div className="oma-sub__admin-row" style={{ marginTop: 12 }}>
                <Button
                  onClick={() =>
                    void (
                      sub.cancel_at_period_end
                        ? resumeSubscription()
                        : cancelSubscriptionAtPeriodEnd()
                    ).then(() => load())
                  }
                >
                  {sub.cancel_at_period_end
                    ? isAr
                      ? 'استئناف الاشتراك'
                      : 'Resume subscription'
                    : isAr
                      ? 'إلغاء في نهاية الفترة'
                      : 'Cancel at period end'}
                </Button>
              </div>
            ) : null}
          </section>

          {checkouts.some((c) => c.status === 'awaiting_payment') ? (
            <section className="oma-sub__admin" aria-label={isAr ? 'طلبات الدفع' : 'Checkouts'}>
              <h2>{isAr ? 'طلبات الدفع المعلّقة' : 'Pending checkouts'}</h2>
              <ul className="oma-sub__requests">
                {checkouts
                  .filter((c) => c.status === 'awaiting_payment')
                  .map((c) => (
                    <li key={c.id}>
                      {c.plan_code} · {c.billing_cycle}
                      {c.amount_usd_cents != null
                        ? ` · $${(c.amount_usd_cents / 100).toFixed(0)}`
                        : ''}
                    </li>
                  ))}
              </ul>
            </section>
          ) : null}

          <section className="oma-sub__bars" aria-label={copy.title}>
            {bars.map((bar) => {
              const label = isAr ? BAR_LABELS[bar.key]?.ar : BAR_LABELS[bar.key]?.en;
              const over = !bar.unlimited && bar.limit != null && bar.used >= bar.limit;
              return (
                <div key={bar.key} className={`oma-sub__bar${over ? ' is-over' : ''}`}>
                  <div className="oma-sub__bar-head">
                    <span>{label ?? bar.key}</span>
                    <span>{formatUsed(bar.key, bar.used, bar.limit, isAr)}</span>
                  </div>
                  <div
                    className="oma-sub__track"
                    role="progressbar"
                    aria-valuenow={bar.pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="oma-sub__fill"
                      style={{ width: `${bar.unlimited ? Math.min(bar.pct || 4, 100) : bar.pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </section>

          {canAdmin ? (
            <p className="oma-sub__admin">
              <a href="/app/billing">{copy.pricing}</a>
            </p>
          ) : null}
        </>
      )}
    </main>
  );
}
