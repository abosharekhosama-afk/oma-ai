'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@oma/ui/controls';
import { useLocale } from '../../../../../lib/use-locale';
import { usePlatformOperator } from '../../../../../lib/use-platform-operator';
import { adminListTenants, adminPatchTenant } from '../../../../../lib/platform-admin-api';
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
        <Button type="button" onClick={() => void load()} disabled={busy}>
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
              <td>
                {t.status === 'ACTIVE' ? (
                  <Button type="button" onClick={() => void suspend(t.id)}>
                    {isAr ? 'إيقاف' : 'Suspend'}
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {nextCursor ? (
        <Button type="button" disabled={busy} onClick={() => setCursor(nextCursor)}>
          {isAr ? 'المزيد' : 'Load more'}
        </Button>
      ) : null}
    </div>
  );
}
