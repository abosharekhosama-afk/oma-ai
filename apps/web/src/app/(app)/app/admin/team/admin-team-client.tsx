'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@oma/ui/controls';
import { useLocale } from '../../../../../lib/use-locale';
import { usePlatformOperator } from '../../../../../lib/use-platform-operator';
import {
  adminCreateOperator,
  adminListOperators,
  adminPatchOperator,
  type AdminOperator,
} from '../../../../../lib/platform-admin-api';
import { useToast } from '../../../../../components/ui/toast';

export default function AdminTeamClient() {
  const isAr = useLocale() === 'ar';
  const { superAdmin } = usePlatformOperator();
  const toast = useToast();
  const [rows, setRows] = useState<AdminOperator[]>([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!superAdmin) return;
    setBusy(true);
    try {
      const res = await adminListOperators();
      setRows(res.data);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Load failed', 'danger');
    } finally {
      setBusy(false);
    }
  }, [superAdmin, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createSupportUser() {
    setBusy(true);
    setTempPassword(null);
    try {
      const res = await adminCreateOperator({
        email: email.trim(),
        name: name.trim() || undefined,
        password: password.trim() || undefined,
        system_role: 'SUPPORT_SPECIALIST',
      });
      toast.push(
        res.data.created
          ? isAr
            ? 'تم إنشاء مستخدم الدعم'
            : 'Support user created'
          : isAr
            ? 'تم ترقية المستخدم'
            : 'User promoted to support',
        'success',
      );
      if (res.data.temporary_password) setTempPassword(res.data.temporary_password);
      setEmail('');
      setName('');
      setPassword('');
      await load();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Create failed', 'danger');
    } finally {
      setBusy(false);
    }
  }

  async function revoke(userId: string) {
    if (!window.confirm(isAr ? 'إزالة صلاحية الدعم؟' : 'Remove support access?')) return;
    try {
      await adminPatchOperator(userId, { system_role: 'USER' });
      toast.push(isAr ? 'تمت الإزالة' : 'Support access removed', 'success');
      await load();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Update failed', 'danger');
    }
  }

  if (!superAdmin) {
    return <p>{isAr ? 'يتطلب Super Admin.' : 'Requires Super Admin.'}</p>;
  }

  return (
    <div className="admin-hub__stack">
      <h1>{isAr ? 'فريق الدعم الفني' : 'Support team'}</h1>
      <p className="admin-hub__muted">
        {isAr
          ? 'أنشئ أو رقِّ مستخدمين بصلاحية SUPPORT_SPECIALIST للوصول إلى مركز الدعم دون صلاحيات Super Admin.'
          : 'Create or promote users with SUPPORT_SPECIALIST to access the support hub without Super Admin powers.'}
      </p>

      <section className="admin-hub__card admin-hub__form">
        <h2>{isAr ? 'إضافة أخصائي دعم' : 'Add support specialist'}</h2>
        <label className="admin-hub__field">
          <span>{isAr ? 'البريد الإلكتروني' : 'Email'}</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
          />
        </label>
        <label className="admin-hub__field">
          <span>{isAr ? 'الاسم' : 'Name'}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="admin-hub__field">
          <span>{isAr ? 'كلمة المرور (اختياري للحسابات الجديدة)' : 'Password (optional for new accounts)'}</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </label>
        <Button htmlType="button" disabled={busy || !email.trim()} onClick={() => void createSupportUser()}>
          {isAr ? 'إنشاء / ترقية' : 'Create / promote'}
        </Button>
        {tempPassword ? (
          <p className="admin-hub__notice" role="status">
            {isAr ? 'كلمة مرور مؤقتة (انسخها الآن): ' : 'Temporary password (copy now): '}
            <code>{tempPassword}</code>
          </p>
        ) : null}
      </section>

      <table className="admin-hub__table">
        <thead>
          <tr>
            <th>{isAr ? 'المستخدم' : 'User'}</th>
            <th>{isAr ? 'الدور' : 'Role'}</th>
            <th>{isAr ? 'الحالة' : 'Status'}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id}>
              <td>
                <div>{u.name}</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{u.email}</div>
              </td>
              <td>{u.system_role}</td>
              <td>{u.status}</td>
              <td>
                {u.system_role === 'SUPPORT_SPECIALIST' ? (
                  <Button htmlType="button" onClick={() => void revoke(u.id)}>
                    {isAr ? 'إزالة الدعم' : 'Revoke support'}
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
