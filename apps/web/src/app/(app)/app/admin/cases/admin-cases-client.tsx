'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@oma/ui/controls';
import { useLocale } from '../../../../../lib/use-locale';
import { usePlatformOperator } from '../../../../../lib/use-platform-operator';
import { useToast } from '../../../../../components/ui/toast';
import {
  supportGetCase,
  supportListCases,
  supportReplyCase,
  type OperatorCase,
} from '../../../../../lib/platform-support-cases-api';

const STATUSES = ['', 'AWAITING_SUPPORT', 'AWAITING_CUSTOMER', 'RESOLVED', 'CLOSED'] as const;

export default function AdminCasesClient() {
  const isAr = useLocale() === 'ar';
  const { support, superAdmin } = usePlatformOperator();
  const toast = useToast();
  const [rows, setRows] = useState<OperatorCase[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<OperatorCase | null>(null);
  const [reply, setReply] = useState('');
  const [internal, setInternal] = useState(false);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const allowed = support || superAdmin;

  const load = useCallback(async () => {
    if (!allowed) return;
    try {
      const res = await supportListCases({
        status: filter || undefined,
        q: q.trim() || undefined,
      });
      setRows(res.data);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Load failed', 'danger');
    }
  }, [allowed, filter, q, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    void supportGetCase(selected)
      .then((r) => {
        setDetail(r.data);
        setStatus(r.data.status);
      })
      .catch((err) => toast.push(err instanceof Error ? err.message : 'Load failed', 'danger'));
  }, [selected, toast]);

  async function send() {
    if (!selected || !reply.trim()) return;
    setBusy(true);
    try {
      const res = await supportReplyCase(selected, {
        message: reply.trim(),
        internal,
        status: status || undefined,
      });
      setDetail(res.data);
      setReply('');
      setInternal(false);
      await load();
      toast.push(isAr ? 'تم الحفظ' : 'Saved', 'success');
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Send failed', 'danger');
    } finally {
      setBusy(false);
    }
  }

  if (!allowed) {
    return <p>{isAr ? 'يتطلب دور الدعم أو Super Admin.' : 'Requires support or Super Admin.'}</p>;
  }

  return (
    <div className="admin-hub__stack">
      <header className="admin-hub__page-head">
        <div>
          <h1>{isAr ? 'تذاكر الدعم' : 'Support tickets'}</h1>
          <p className="admin-hub__muted">
            {isAr
              ? 'مراجعة طلبات العملاء والرد عليها. الملاحظات الداخلية لا يراها العميل.'
              : 'Review customer requests and reply. Internal notes are hidden from customers.'}
          </p>
        </div>
      </header>

      <div className="admin-hub__row">
        <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Status">
          <option value="">{isAr ? 'كل الحالات' : 'All statuses'}</option>
          {STATUSES.filter(Boolean).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={isAr ? 'بحث' : 'Search'}
        />
        <Button htmlType="button" onClick={() => void load()}>
          {isAr ? 'تحديث' : 'Refresh'}
        </Button>
      </div>

      <div className="admin-hub__split">
        <table className="admin-hub__table">
          <thead>
            <tr>
              <th>{isAr ? 'الموضوع' : 'Subject'}</th>
              <th>{isAr ? 'المستأجر' : 'Tenant'}</th>
              <th>{isAr ? 'الحالة' : 'Status'}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr
                key={c.id}
                data-selected={selected === c.id ? 'true' : 'false'}
                onClick={() => setSelected(c.id)}
                style={{ cursor: 'pointer' }}
              >
                <td>{c.subject}</td>
                <td>{c.tenant?.name ?? c.tenant_id}</td>
                <td>{c.status}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {detail ? (
          <section className="admin-hub__card admin-hub__form admin-hub__case-detail">
            <h2>{detail.subject}</h2>
            <p className="admin-hub__muted">
              {detail.tenant?.name} · {detail.status}
            </p>
            <div className="admin-hub__message-thread">
              {detail.messages?.map((m) => (
                <article
                  key={m.id}
                  className={
                    m.internal ? 'admin-hub__msg admin-hub__msg--internal' : 'admin-hub__msg'
                  }
                >
                  <header>
                    <strong>
                      {m.author_name} · {m.author_kind}
                      {m.internal ? (isAr ? ' · داخلي' : ' · internal') : null}
                    </strong>
                  </header>
                  <p>{m.body}</p>
                </article>
              ))}
            </div>
            <label className="admin-hub__field">
              <span>{isAr ? 'الرد' : 'Reply'}</span>
              <textarea rows={4} value={reply} onChange={(e) => setReply(e.target.value)} />
            </label>
            <label className="admin-hub__check">
              <input
                type="checkbox"
                checked={internal}
                onChange={(e) => setInternal(e.target.checked)}
              />
              {isAr ? 'ملاحظة داخلية (لا تُرسل للعميل)' : 'Internal note (not visible to customer)'}
            </label>
            <label className="admin-hub__field">
              <span>{isAr ? 'تحديث الحالة' : 'Set status'}</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUSES.filter(Boolean).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <Button
              htmlType="button"
              type="primary"
              disabled={busy || !reply.trim()}
              onClick={() => void send()}
            >
              {isAr ? 'إرسال' : 'Send'}
            </Button>
          </section>
        ) : null}
      </div>
    </div>
  );
}
