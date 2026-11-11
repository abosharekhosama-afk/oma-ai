'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@oma/ui/controls';
import { useLocale } from '../../../../lib/use-locale';
import { useToast } from '../../../../components/ui/toast';
import {
  createHelpdeskCase,
  getHelpdeskCase,
  listHelpdeskCases,
  replyHelpdeskCase,
  type HelpdeskCase,
} from '../../../../lib/helpdesk-api';
import './help.css';

export default function HelpClient() {
  const isAr = useLocale() === 'ar';
  const toast = useToast();
  const [cases, setCases] = useState<HelpdeskCase[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<HelpdeskCase | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await listHelpdeskCases();
      setCases(res.data);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Load failed', 'danger');
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    void getHelpdeskCase(selected)
      .then((r) => setDetail(r.data))
      .catch((err) => toast.push(err instanceof Error ? err.message : 'Load failed', 'danger'));
  }, [selected, toast]);

  async function submitNew() {
    setBusy(true);
    try {
      const res = await createHelpdeskCase({ subject: subject.trim(), message: message.trim() });
      toast.push(isAr ? 'تم فتح التذكرة' : 'Ticket opened', 'success');
      setSubject('');
      setMessage('');
      setSelected(res.data.id);
      await load();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Create failed', 'danger');
    } finally {
      setBusy(false);
    }
  }

  async function sendReply() {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await replyHelpdeskCase(selected, reply.trim());
      setDetail(res.data);
      setReply('');
      await load();
      toast.push(isAr ? 'تم الإرسال' : 'Sent', 'success');
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Send failed', 'danger');
    } finally {
      setBusy(false);
    }
  }

  const statusLabel = (s: string) => {
    const map: Record<string, { en: string; ar: string }> = {
      OPEN: { en: 'Open', ar: 'مفتوحة' },
      AWAITING_SUPPORT: { en: 'Awaiting support', ar: 'بانتظار الدعم' },
      AWAITING_CUSTOMER: { en: 'Awaiting your reply', ar: 'بانتظار ردك' },
      RESOLVED: { en: 'Resolved', ar: 'محلولة' },
      CLOSED: { en: 'Closed', ar: 'مغلقة' },
    };
    return isAr ? (map[s]?.ar ?? s) : (map[s]?.en ?? s);
  };

  return (
    <div className="oma-help" dir={isAr ? 'rtl' : 'ltr'}>
      <header className="oma-help__hero">
        <h1>{isAr ? 'الدعم الفني' : 'Contact support'}</h1>
        <p>
          {isAr
            ? 'افتح تذكرة لمساحة عملك الحالية. يرد فريق OMA من لوحة عمليات المنصة.'
            : 'Open a ticket for your active workspace. OMA operators reply from the platform hub.'}
        </p>
      </header>

      <div className="oma-help__grid">
        <section className="oma-help__panel">
          <h2>{isAr ? 'تذكرة جديدة' : 'New ticket'}</h2>
          <label className="oma-help__field">
            <span>{isAr ? 'الموضوع' : 'Subject'}</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>
          <label className="oma-help__field">
            <span>{isAr ? 'الرسالة' : 'Message'}</span>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} />
          </label>
          <Button
            htmlType="button"
            type="primary"
            disabled={busy || subject.trim().length < 3 || !message.trim()}
            onClick={() => void submitNew()}
          >
            {isAr ? 'إرسال' : 'Submit'}
          </Button>
        </section>

        <section className="oma-help__panel">
          <h2>{isAr ? 'تذاكري' : 'My tickets'}</h2>
          <ul className="oma-help__list">
            {cases.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={selected === c.id ? 'is-active' : undefined}
                  onClick={() => setSelected(c.id)}
                >
                  <strong>{c.subject}</strong>
                  <span>{statusLabel(c.status)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {detail ? (
        <section className="oma-help__thread">
          <h2>{detail.subject}</h2>
          <p className="oma-help__meta">{statusLabel(detail.status)}</p>
          <div className="oma-help__messages">
            {detail.messages?.map((m) => (
              <article key={m.id} data-kind={m.author_kind}>
                <header>
                  <strong>{m.author_name}</strong>
                  <time dateTime={m.created_at}>{new Date(m.created_at).toLocaleString()}</time>
                </header>
                <p>{m.body}</p>
              </article>
            ))}
          </div>
          {detail.status !== 'CLOSED' ? (
            <div className="oma-help__reply">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={isAr ? 'ردك…' : 'Your reply…'}
                rows={3}
              />
              <Button
                htmlType="button"
                type="primary"
                disabled={busy || !reply.trim()}
                onClick={() => void sendReply()}
              >
                {isAr ? 'رد' : 'Reply'}
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
