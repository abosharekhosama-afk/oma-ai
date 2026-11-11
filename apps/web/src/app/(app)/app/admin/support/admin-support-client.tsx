'use client';

import { useState } from 'react';
import { Button } from '@oma/ui/controls';
import { useLocale } from '../../../../../lib/use-locale';
import { usePlatformOperator } from '../../../../../lib/use-platform-operator';
import {
  supportAssumeImpersonation,
  supportLookup,
  supportPublishingFailures,
  supportRetryPublish,
  supportStartImpersonation,
  supportTenantSocial,
  supportTenantStorage,
} from '../../../../../lib/platform-support-api';
import { useToast } from '../../../../../components/ui/toast';

export default function AdminSupportClient() {
  const isAr = useLocale() === 'ar';
  const { support, superAdmin } = usePlatformOperator();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [selectedTenant, setSelectedTenant] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [reason, setReason] = useState('');
  const [lookup, setLookup] = useState<{
    users: Array<{ id: string; email: string; name: string }>;
    tenants: Array<{ id: string; name: string; slug: string }>;
  } | null>(null);
  const [social, setSocial] = useState<Array<Record<string, unknown>> | null>(null);
  const [storage, setStorage] = useState<Record<string, unknown> | null>(null);
  const [failures, setFailures] = useState<Array<Record<string, unknown>>>([]);
  const [busy, setBusy] = useState(false);

  if (!support && !superAdmin) {
    return <p>{isAr ? 'غير مصرّح.' : 'Not authorized.'}</p>;
  }

  async function runLookup() {
    setBusy(true);
    try {
      const res = await supportLookup(q.trim());
      setLookup({ users: res.data.users, tenants: res.data.tenants });
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Lookup failed', 'danger');
    } finally {
      setBusy(false);
    }
  }

  async function loadDiagnostics(tenantId: string) {
    setSelectedTenant(tenantId);
    setBusy(true);
    try {
      const [s, st, f] = await Promise.all([
        supportTenantSocial(tenantId),
        supportTenantStorage(tenantId),
        supportPublishingFailures(tenantId),
      ]);
      setSocial(s.data);
      setStorage(st.data);
      setFailures(f.data);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Diagnostics failed', 'danger');
    } finally {
      setBusy(false);
    }
  }

  async function impersonate() {
    if (!selectedTenant || !selectedUser || reason.trim().length < 8) {
      toast.push(
        isAr ? 'اختر مستأجراً ومستخدمًا وسبباً (8+ أحرف)' : 'Pick tenant, user, reason (8+ chars)',
        'danger',
      );
      return;
    }
    setBusy(true);
    try {
      const started = await supportStartImpersonation({
        target_user_id: selectedUser,
        tenant_id: selectedTenant,
        reason: reason.trim(),
      });
      const assumed = await supportAssumeImpersonation(started.data.impersonation_id);
      toast.push(isAr ? 'تم تفعيل جلسة العميل' : 'Client session active', 'success');
      window.location.href = assumed.data.redirect_url;
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Impersonation failed', 'danger');
    } finally {
      setBusy(false);
    }
  }

  async function retry(id: string) {
    try {
      const r = await supportRetryPublish(id);
      toast.push(
        isAr ? `أُعيدت ${r.data.enqueued_jobs} مهمة` : `Requeued ${r.data.enqueued_jobs} job(s)`,
        'success',
      );
      if (selectedTenant) void loadDiagnostics(selectedTenant);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Retry failed', 'danger');
    }
  }

  return (
    <div className="admin-hub__stack">
      <h1>{isAr ? 'مركز الدعم الفني' : 'Support specialist hub'}</h1>

      <section className="admin-hub__card">
        <h3>{isAr ? 'بحث العملاء' : 'Client lookup'}</h3>
        <div className="admin-hub__row">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={isAr ? 'بريد، اسم، معرّف' : 'Email, name, or id'}
          />
          <Button htmlType="button" onClick={() => void runLookup()} disabled={busy}>
            {isAr ? 'بحث' : 'Search'}
          </Button>
        </div>
        {lookup ? (
          <div className="admin-hub__row" style={{ alignItems: 'flex-start', marginTop: '1rem' }}>
            <div>
              <strong>{isAr ? 'مستأجرون' : 'Tenants'}</strong>
              <ul>
                {lookup.tenants.map((t) => (
                  <li key={t.id}>
                    <button type="button" onClick={() => void loadDiagnostics(t.id)}>
                      {t.name} ({t.slug})
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <strong>{isAr ? 'مستخدمون' : 'Users'}</strong>
              <ul>
                {lookup.users.map((u) => (
                  <li key={u.id}>
                    <button type="button" onClick={() => setSelectedUser(u.id)}>
                      {u.name} — {u.email}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </section>

      {selectedTenant ? (
        <>
          <div className="admin-hub__diag-grid">
            <section className="admin-hub__diag-card">
              <h3>{isAr ? 'حسابات التواصل' : 'Social connections'}</h3>
              <ul>
                {(Array.isArray(social) ? social : []).slice(0, 12).map((row) => (
                  <li key={String((row as { id?: string }).id)}>
                    <strong>{String((row as { network?: string }).network ?? '—')}</strong> ·{' '}
                    {String((row as { name?: string }).name ?? '')} ·{' '}
                    {String((row as { status?: string }).status ?? '—')}
                    {(row as { last_error?: string }).last_error
                      ? ` · ${String((row as { last_error?: string }).last_error)}`
                      : ''}
                  </li>
                ))}
              </ul>
            </section>
            <section className="admin-hub__diag-card">
              <h3>{isAr ? 'التخزين' : 'Storage'}</h3>
              <ul>
                {storage
                  ? Object.entries(storage).map(([k, v]) => (
                      <li key={k}>
                        <strong>{k}</strong>: {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                      </li>
                    ))
                  : null}
              </ul>
            </section>
          </div>
          <section className="admin-hub__card">
            <h3>{isAr ? 'فشل النشر' : 'Publishing failures'}</h3>
            <ul>
              {failures.map((f) => (
                <li key={String(f.id)}>
                  {String(f.content_title ?? f.id)} — {String(f.last_error ?? '')}
                  <Button htmlType="button" onClick={() => void retry(String(f.id))}>
                    {isAr ? 'إعادة المحاولة' : 'Retry'}
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}

      <section className="admin-hub__card">
        <h3>{isAr ? 'دخول كعميل' : 'Login as customer'}</h3>
        <p style={{ fontSize: '0.85rem' }}>
          {isAr ? 'المستأجر:' : 'Tenant:'} {selectedTenant || '—'} · {isAr ? 'المستخدم:' : 'User:'}{' '}
          {selectedUser || '—'}
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={isAr ? 'سبب تذكرة الدعم (8+ أحرف)' : 'Support ticket reason (8+ chars)'}
        />
        <div className="admin-hub__row" style={{ marginTop: '0.5rem' }}>
          <Button htmlType="button" disabled={busy} onClick={() => void impersonate()}>
            {isAr ? 'افتح لوحة العميل' : 'Open client workspace'}
          </Button>
        </div>
      </section>
    </div>
  );
}
