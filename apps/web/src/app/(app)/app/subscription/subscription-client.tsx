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
  listUpgradeRequests,
  type SubscriptionView,
} from '../../../../lib/billing-api';
import '../billing/billing.css';

const BAR_LABELS: Record<string, { en: string; ar: string }> = {
  brands: { en: 'Brands', ar: 'العلامات' },
  social_channels: { en: 'Social channels', ar: 'القنوات الاجتماعية' },
  seats: { en: 'Team seats', ar: 'مقاعد الفريق' },
  guests: { en: 'Guests / clients', ar: 'الضيوف / العملاء' },
  posts_per_month: { en: 'Posts this month', ar: 'منشورات هذا الشهر' },
  posts_total: { en: 'Posts (lifetime)', ar: 'منشورات (إجمالي)' },
  storage_bytes: { en: 'Work Drive storage', ar: 'تخزين مساحة العمل' },
  approval_level: { en: 'Approval level', ar: 'مستوى الموافقات' },
  ai_runs_per_month: { en: 'AI assists this month', ar: 'مساعدات الذكاء هذا الشهر' },
};

function formatUsed(key: string, used: number, limit: number | null, isAr: boolean) {
  if (key === 'storage_bytes') {
    const toGb = (n: number) => {
      const gb = n / (1024 * 1024 * 1024);
      return `${gb < 0.1 && n > 0 ? gb.toFixed(2) : gb.toFixed(1)} GB`;
    };
    return limit == null
      ? toGb(used)
      : `${toGb(used)} / ${toGb(limit)}`;
  }
  if (limit == null) return `${used} · ${isAr ? 'غير محدود' : 'Unlimited'}`;
  return `${used} / ${limit}`;
}

export default function SubscriptionClient() {
  const isAr = useLocale() === 'ar';
  const toast = useToast();
  const caps = useCapabilities();
  const canAdmin = caps.can('tenant.manage');
  const [sub, setSub] = useState<SubscriptionView | null>(null);
  const [requests, setRequests] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [adminPlan, setAdminPlan] = useState('pro');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await getSubscription();
      setSub(s.data);
      setAdminPlan(s.data.plan_code);
      if (canAdmin) {
        const r = await listUpgradeRequests().catch(() => ({ data: [] }));
        setRequests(r.data ?? []);
      }
    } catch {
      toast.push(isAr ? 'تعذر تحميل الاشتراك' : 'Could not load subscription', 'danger');
    } finally {
      setLoading(false);
    }
  }, [canAdmin, isAr, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function applyPlan() {
    if (!canAdmin) return;
    setBusy(true);
    try {
      await changePlan({ plan_code: adminPlan, notes: 'Admin manual plan change (payment deferred)' });
      toast.push(isAr ? 'تم تحديث الخطة' : 'Plan updated', 'success');
      await load();
    } catch {
      toast.push(isAr ? 'تعذر تحديث الخطة' : 'Could not update plan', 'danger');
    } finally {
      setBusy(false);
    }
  }

  const copy = isAr
    ? {
        title: 'الاشتراك والاستخدام',
        sub: 'تابع استخدامك مقارنة بحدود خطتك الحالية.',
        pricing: 'الخطط والأسعار',
        back: 'العودة',
        current: 'الخطة الحالية',
        deferred: 'الدفع قريباً — لا يتم تحصيل أي مبلغ الآن.',
        grandfather: 'مساحة العمل هذه على خطة مرحّلة من قبل التفعيل.',
        admin: 'تغيير الخطة (مسؤول)',
        apply: 'تطبيق',
        requests: 'طلبات الترقية',
        none: 'لا توجد طلبات.',
        loading: 'جاري التحميل…',
      }
    : {
        title: 'Subscription & usage',
        sub: 'See how your workspace usage compares to your plan limits.',
        pricing: 'Plans & pricing',
        back: 'Back',
        current: 'Current plan',
        deferred: 'Payment coming soon — nothing is charged yet.',
        grandfather: 'This workspace was grandfathered onto this plan at rollout.',
        admin: 'Change plan (admin)',
        apply: 'Apply',
        requests: 'Upgrade requests',
        none: 'No requests yet.',
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
          <Link className="oma-billing__icon-link" href="/app/billing" aria-label={copy.pricing} title={copy.pricing}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
            </svg>
          </Link>
          <Link className="oma-billing__icon-link" href="/app" aria-label={copy.back} title={copy.back}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d={isAr ? 'M5 12h14M11 6l-6 6 6 6' : 'M19 12H5M11 6l-6 6 6 6'} />
            </svg>
          </Link>
        </div>
      </header>

      <div className="oma-billing__notice" role="status">{copy.deferred}</div>

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
          </section>

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
                  <div className="oma-sub__track" role="progressbar" aria-valuenow={bar.pct} aria-valuemin={0} aria-valuemax={100}>
                    <div className="oma-sub__fill" style={{ width: `${bar.unlimited ? Math.min(bar.pct || 4, 100) : bar.pct}%` }} />
                  </div>
                </div>
              );
            })}
          </section>

          {canAdmin ? (
            <section className="oma-sub__admin" aria-label={copy.admin}>
              <h2>{copy.admin}</h2>
              <div className="oma-sub__admin-row">
                <select value={adminPlan} onChange={(e) => setAdminPlan(e.target.value)} aria-label={copy.admin}>
                  <option value="free">{isAr ? 'مجانية' : 'Free'}</option>
                  <option value="basic">{isAr ? 'أساسية' : 'Basic'}</option>
                  <option value="pro">{isAr ? 'احترافية' : 'Pro'}</option>
                  <option value="enterprise">{isAr ? 'مؤسسات' : 'Enterprise'}</option>
                </select>
                <Button type="primary" disabled={busy || adminPlan === sub.plan_code} onClick={() => void applyPlan()}>
                  {copy.apply}
                </Button>
              </div>

              <h3 style={{ marginTop: 28 }}>{copy.requests}</h3>
              {requests.length === 0 ? (
                <p className="oma-billing__desc">{copy.none}</p>
              ) : (
                <ul className="oma-sub__requests">
                  {requests.map((r) => (
                    <li key={String(r.id)}>
                      {String(r.from_plan_code)} → {String(r.to_plan_code)} · {String(r.status)}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
