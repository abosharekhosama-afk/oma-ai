'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@oma/ui/controls';
import { useLocale } from '../../../../../lib/use-locale';
import { usePlatformOperator } from '../../../../../lib/use-platform-operator';
import { supportPublishingFailures, supportRetryPublish } from '../../../../../lib/platform-support-api';
import { useToast } from '../../../../../components/ui/toast';

export default function AdminIssuesClient() {
  const isAr = useLocale() === 'ar';
  const { support, superAdmin } = usePlatformOperator();
  const toast = useToast();
  const [failures, setFailures] = useState<Array<Record<string, unknown>>>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await supportPublishingFailures();
      setFailures(res.data);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Load failed', 'danger');
    }
  }, [toast]);

  useEffect(() => {
    if (support || superAdmin) void load();
  }, [load, support, superAdmin]);

  async function retry(id: string) {
    setBusy(true);
    try {
      await supportRetryPublish(id);
      toast.push(isAr ? 'أُعيدت المهمة' : 'Retried', 'success');
      await load();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Retry failed', 'danger');
    } finally {
      setBusy(false);
    }
  }

  if (!support && !superAdmin) {
    return <p>{isAr ? 'غير مصرّح.' : 'Not authorized.'}</p>;
  }

  return (
    <div className="admin-hub__stack">
      <header className="admin-hub__page-head">
        <h1>{isAr ? 'الأخطاء ومشاكل النشر' : 'Errors & publishing failures'}</h1>
        <p className="admin-hub__muted">
          {isAr
            ? 'سجل أحدث حالات فشل النشر عبر المنصة. استخدم التشخيص لسياق المستأجر.'
            : 'Recent publish/worker failures across the platform. Use Diagnostics for tenant context.'}
        </p>
      </header>
      <div className="admin-hub__row">
        <Button htmlType="button" disabled={busy} onClick={() => void load()}>
          {isAr ? 'تحديث' : 'Refresh'}
        </Button>
      </div>
      <div className="admin-hub__diag-grid">
        {failures.length === 0 ? (
          <div className="oma-plx-listening-card admin-hub__card">
            <p>{isAr ? 'لا توجد أخطاء مسجّلة حالياً.' : 'No failures recorded right now.'}</p>
          </div>
        ) : (
          failures.map((f) => (
            <article key={String(f.id)} className="admin-hub__diag-card">
              <h3>{String(f.content_title ?? f.id)}</h3>
              <ul>
                <li>
                  <strong>{isAr ? 'المستأجر' : 'Tenant'}:</strong> {String(f.tenant_id ?? '—')}
                </li>
                <li>
                  <strong>{isAr ? 'الخطأ' : 'Error'}:</strong> {String(f.last_error ?? '—')}
                </li>
                <li>
                  <strong>{isAr ? 'الحالة' : 'Status'}:</strong> {String(f.status ?? '—')}
                </li>
              </ul>
              <Button htmlType="button" onClick={() => void retry(String(f.id))}>
                {isAr ? 'إعادة المحاولة' : 'Retry'}
              </Button>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
