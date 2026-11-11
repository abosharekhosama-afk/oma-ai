'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@oma/ui/controls';
import { useLocale } from '../../../../../lib/use-locale';
import { usePlatformOperator } from '../../../../../lib/use-platform-operator';
import {
  adminListPlans,
  adminPatchPlan,
  type AdminPlanRow,
} from '../../../../../lib/platform-admin-api';
import { useToast } from '../../../../../components/ui/toast';

const LIMIT_FIELDS: Array<{ key: string; labelEn: string; labelAr: string; hint?: string }> = [
  { key: 'brands', labelEn: 'Brands', labelAr: 'العلامات' },
  { key: 'social_accounts', labelEn: 'Social accounts', labelAr: 'حسابات اجتماعية' },
  { key: 'seats', labelEn: 'Seats', labelAr: 'مقاعد' },
  { key: 'guests', labelEn: 'Guests', labelAr: 'ضيوف' },
  {
    key: 'scheduled_posts_per_month',
    labelEn: 'Scheduled posts / month',
    labelAr: 'منشورات مجدولة / شهر',
  },
  {
    key: 'storage_bytes',
    labelEn: 'Storage (bytes)',
    labelAr: 'التخزين (بايت)',
    hint: '1073741824 = 1 GB',
  },
  { key: 'ai_credits_per_month', labelEn: 'AI credits / month', labelAr: 'رصيد AI / شهر' },
  { key: 'listening_keywords', labelEn: 'Listening keywords', labelAr: 'كلمات الاستماع' },
  { key: 'mentions_per_month', labelEn: 'Mentions / month', labelAr: 'إشارات / شهر' },
  { key: 'approval_level', labelEn: 'Approval level (1–3)', labelAr: 'مستوى الموافقة (1–3)' },
];

type Draft = {
  priceMonthly: string;
  priceYearly: string;
  limits: Record<string, string>;
};

function emptyDraft(plan: AdminPlanRow): Draft {
  return {
    priceMonthly: String((plan.price_monthly_usd_cents / 100).toFixed(2)),
    priceYearly: String((plan.price_yearly_per_month_usd_cents / 100).toFixed(2)),
    limits: Object.fromEntries(
      LIMIT_FIELDS.map((f) => {
        const v = plan.limits[f.key];
        return [f.key, v == null ? '' : String(v)];
      }),
    ),
  };
}

export default function AdminPlansClient() {
  const isAr = useLocale() === 'ar';
  const { superAdmin } = usePlatformOperator();
  const toast = useToast();
  const [plans, setPlans] = useState<AdminPlanRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!superAdmin) return;
    try {
      const res = await adminListPlans();
      setPlans(res.data);
      setDrafts(Object.fromEntries(res.data.map((p) => [p.code, emptyDraft(p)])));
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Load failed', 'danger');
    }
  }, [superAdmin, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  function setDraftField(
    planCode: string,
    field: keyof Draft | string,
    value: string,
    isLimit?: boolean,
  ) {
    setDrafts((prev) => {
      const d = prev[planCode];
      if (!d) return prev;
      if (isLimit) {
        return { ...prev, [planCode]: { ...d, limits: { ...d.limits, [field]: value } } };
      }
      return { ...prev, [planCode]: { ...d, [field]: value } };
    });
  }

  async function save(planCode: string) {
    const d = drafts[planCode];
    if (!d) return;
    setBusy(planCode);
    try {
      const limits: Record<string, number | null> = {};
      for (const f of LIMIT_FIELDS) {
        const raw = d.limits[f.key]?.trim();
        if (raw === '' || raw === '∞') limits[f.key] = null;
        else limits[f.key] = Number(raw);
      }
      await adminPatchPlan(planCode, {
        price_monthly_usd_cents: Math.round(Number(d.priceMonthly) * 100),
        price_yearly_per_month_usd_cents: Math.round(Number(d.priceYearly) * 100),
        limits,
      });
      toast.push(isAr ? 'تم حفظ الخطة' : 'Plan saved', 'success');
      await load();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Save failed', 'danger');
    } finally {
      setBusy(null);
    }
  }

  if (!superAdmin) {
    return <p>{isAr ? 'يتطلب Super Admin.' : 'Requires Super Admin.'}</p>;
  }

  return (
    <div className="admin-hub__stack">
      <h1>{isAr ? 'الخطط والأسعار وحدود الاستخدام' : 'Plans, pricing & usage limits'}</h1>
      <p className="admin-hub__muted">
        {isAr
          ? 'تعديلات الأسعار والحدود تُخزَّن في قاعدة البيانات وتُطبَّق فوراً على مساحات العمل الجديدة والحالية.'
          : 'Price and limit edits persist to the database and apply immediately to new and existing workspaces.'}
      </p>
      {plans.map((plan) => {
        const d = drafts[plan.code];
        if (!d) return null;
        return (
          <section key={plan.code} className="admin-hub__card admin-hub__form">
            <h2>
              {isAr ? plan.name_ar : plan.name_en}{' '}
              <span className="admin-hub__tag">{plan.code}</span>
            </h2>
            <div className="admin-hub__row">
              <label className="admin-hub__field">
                <span>{isAr ? 'السعر الشهري (USD)' : 'Monthly price (USD)'}</span>
                <input
                  inputMode="decimal"
                  value={d.priceMonthly}
                  onChange={(e) => setDraftField(plan.code, 'priceMonthly', e.target.value)}
                />
              </label>
              <label className="admin-hub__field">
                <span>{isAr ? 'شهري ضمن السنوي (USD)' : 'Yearly per-month (USD)'}</span>
                <input
                  inputMode="decimal"
                  value={d.priceYearly}
                  onChange={(e) => setDraftField(plan.code, 'priceYearly', e.target.value)}
                />
              </label>
            </div>
            <div className="admin-hub__limit-grid">
              {LIMIT_FIELDS.map((f) => (
                <label key={f.key} className="admin-hub__field">
                  <span>{isAr ? f.labelAr : f.labelEn}</span>
                  <input
                    value={d.limits[f.key] ?? ''}
                    placeholder={isAr ? 'فارغ = غير محدود' : 'empty = unlimited'}
                    onChange={(e) => setDraftField(plan.code, f.key, e.target.value, true)}
                  />
                  {f.hint ? <small className="admin-hub__muted">{f.hint}</small> : null}
                </label>
              ))}
            </div>
            <Button
              htmlType="button"
              type="primary"
              disabled={busy === plan.code}
              onClick={() => void save(plan.code)}
            >
              {busy === plan.code ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : isAr ? 'حفظ' : 'Save'}
            </Button>
          </section>
        );
      })}
    </div>
  );
}
