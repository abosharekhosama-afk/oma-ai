'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@oma/ui/controls';
import { useLocale } from '../../../../../lib/use-locale';
import { usePlatformOperator } from '../../../../../lib/use-platform-operator';
import {
  adminListTenants,
  adminPatchTenant,
  adminTenantDetail,
} from '../../../../../lib/platform-admin-api';
import { useToast } from '../../../../../components/ui/toast';

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan_code: string | null;
  subscription_status: string | null;
  storage_mode: string;
};

export default function AdminTenantsClient() {
  const isAr = useLocale() === 'ar';
  const { superAdmin } = usePlatformOperator();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<TenantRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editPlan, setEditPlan] = useState('pro');
  const [editStorageGb, setEditStorageGb] = useState('');
  const [limitBrands, setLimitBrands] = useState('');
  const [limitSocial, setLimitSocial] = useState('');
  const [limitAi, setLimitAi] = useState('');
  const [limitPosts, setLimitPosts] = useState('');

  const load = useCallback(async () => {
    if (!superAdmin) return;
    setBusy(true);
    try {
      const res = await adminListTenants({ q: q.trim() || undefined, cursor: cursor ?? undefined });
      setRows(cursor ? (prev) => [...prev, ...res.data] : res.data);
      setNextCursor(res.page.next_cursor);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Load failed', 'danger');
    } finally {
      setBusy(false);
    }
  }, [superAdmin, q, cursor, toast]);

  useEffect(() => {
    setCursor(null);
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openEdit(tenantId: string) {
    setSelectedId(tenantId);
    try {
      const res = await adminTenantDetail(tenantId);
      const d = res.data;
      setEditPlan(String(d.plan_code ?? 'pro'));
      const override = d.storage_limit_bytes_override;
      const planLim = d.plan_storage_limit_bytes;
      const bytes = override ?? planLim;
      setEditStorageGb(bytes != null ? String(Number(bytes) / (1024 * 1024 * 1024)) : '');
      const ov = (d.usage_overrides ?? {}) as Record<string, number | null>;
      const fmt = (k: string) => (ov[k] == null ? '' : String(ov[k]));
      setLimitBrands(fmt('brands'));
      setLimitSocial(fmt('social_accounts'));
      setLimitAi(fmt('ai_credits_per_month'));
      setLimitPosts(fmt('scheduled_posts_per_month'));
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Load failed', 'danger');
    }
  }

  async function saveTenantPlan() {
    if (!selectedId) return;
    try {
      const storage_limit_bytes =
        editStorageGb.trim() === '' ? null : Math.round(Number(editStorageGb) * 1024 * 1024 * 1024);
      const numOrNull = (s: string) => (s.trim() === '' ? null : Math.floor(Number(s)));
      await adminPatchTenant(selectedId, {
        plan_code: editPlan,
        storage_limit_bytes,
        usage_overrides: {
          brands: numOrNull(limitBrands),
          social_accounts: numOrNull(limitSocial),
          ai_credits_per_month: numOrNull(limitAi),
          scheduled_posts_per_month: numOrNull(limitPosts),
        },
      });
      toast.push(isAr ? 'تم تحديث الخطة والحدود' : 'Plan and limits updated', 'success');
      setSelectedId(null);
      setCursor(null);
      setRows([]);
      void load();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Update failed', 'danger');
    }
  }

  async function suspend(tenantId: string) {
    try {
      await adminPatchTenant(tenantId, { status: 'SUSPENDED' });
      toast.push(isAr ? 'تم الإيقاف' : 'Tenant suspended', 'success');
      setCursor(null);
      setRows([]);
      void load();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Update failed', 'danger');
    }
  }

  if (!superAdmin) {
    return <p>{isAr ? 'يتطلب Super Admin.' : 'Requires Super Admin.'}</p>;
  }

  return (
    <div className="admin-hub__stack">
      <h1>{isAr ? 'إدارة المستأجرين' : 'Tenant management'}</h1>
      <div className="admin-hub__row">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={isAr ? 'بحث بالاسم أو المعرّف' : 'Search name, slug, or id'}
          aria-label={isAr ? 'بحث' : 'Search'}
        />
        <Button htmlType="button" onClick={() => void load()} disabled={busy}>
          {isAr ? 'بحث' : 'Search'}
        </Button>
      </div>
      <table className="admin-hub__table">
        <thead>
          <tr>
            <th>{isAr ? 'الاسم' : 'Name'}</th>
            <th>{isAr ? 'الحالة' : 'Status'}</th>
            <th>{isAr ? 'الخطة' : 'Plan'}</th>
            <th>{isAr ? 'التخزين' : 'Storage'}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id}>
              <td>
                <div>{t.name}</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{t.slug}</div>
              </td>
              <td>{t.status}</td>
              <td>
                {t.plan_code ?? '—'} / {t.subscription_status ?? '—'}
              </td>
              <td>{t.storage_mode}</td>
              <td className="admin-hub__actions">
                <Button htmlType="button" onClick={() => void openEdit(t.id)}>
                  {isAr ? 'خطة وحدود' : 'Plan & limits'}
                </Button>
                {t.status === 'ACTIVE' ? (
                  <Button htmlType="button" onClick={() => void suspend(t.id)}>
                    {isAr ? 'إيقاف' : 'Suspend'}
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {nextCursor ? (
        <Button htmlType="button" disabled={busy} onClick={() => setCursor(nextCursor)}>
          {isAr ? 'المزيد' : 'Load more'}
        </Button>
      ) : null}

      {selectedId ? (
        <section
          className="admin-hub__card admin-hub__form"
          role="dialog"
          aria-labelledby="tenant-edit-title"
        >
          <h2 id="tenant-edit-title">
            {isAr ? 'تعديل الخطة والتخزين' : 'Edit plan & storage override'}
          </h2>
          <label className="admin-hub__field">
            <span>{isAr ? 'رمز الخطة' : 'Plan code'}</span>
            <select value={editPlan} onChange={(e) => setEditPlan(e.target.value)}>
              <option value="starter">starter</option>
              <option value="pro">pro</option>
              <option value="agency">agency</option>
            </select>
          </label>
          <label className="admin-hub__field">
            <span>
              {isAr
                ? 'حد التخزين الإداري (GB، فارغ = الافتراضي للخطة)'
                : 'Admin storage cap (GB, empty = plan default)'}
            </span>
            <input
              inputMode="decimal"
              value={editStorageGb}
              onChange={(e) => setEditStorageGb(e.target.value)}
            />
          </label>
          <div className="admin-hub__limit-grid">
            <label className="admin-hub__field">
              <span>{isAr ? 'علامات (تجاوز)' : 'Brands override'}</span>
              <input
                value={limitBrands}
                onChange={(e) => setLimitBrands(e.target.value)}
                placeholder="∞"
              />
            </label>
            <label className="admin-hub__field">
              <span>{isAr ? 'حسابات اجتماعية' : 'Social accounts'}</span>
              <input value={limitSocial} onChange={(e) => setLimitSocial(e.target.value)} />
            </label>
            <label className="admin-hub__field">
              <span>{isAr ? 'رصيد AI / شهر' : 'AI credits / mo'}</span>
              <input value={limitAi} onChange={(e) => setLimitAi(e.target.value)} />
            </label>
            <label className="admin-hub__field">
              <span>{isAr ? 'منشورات مجدولة / شهر' : 'Scheduled posts / mo'}</span>
              <input value={limitPosts} onChange={(e) => setLimitPosts(e.target.value)} />
            </label>
          </div>
          <div className="admin-hub__row">
            <Button htmlType="button" type="primary" onClick={() => void saveTenantPlan()}>
              {isAr ? 'حفظ' : 'Save'}
            </Button>
            <Button htmlType="button" onClick={() => setSelectedId(null)}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
