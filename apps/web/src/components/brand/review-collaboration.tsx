'use client';
import { Button, TextArea } from '@oma/ui/controls';

import { FormEvent, useState } from 'react';
import { useT } from '../../lib/use-locale';

type HistoryItem = {
  id: string;
  kind: string;
  action: string;
  created_at: string;
};

type ReviewCollaborationProps = {
  status: string;
  blockingReasons: string[];
  reviewHistory?: HistoryItem[];
  collaborationNote?: string;
  onSaveNote?: (note: string) => Promise<void>;
};

export function ReviewCollaboration({
  status,
  blockingReasons,
  reviewHistory = [],
  collaborationNote = '',
  onSaveNote,
}: ReviewCollaborationProps) {
  const t = useT();
  const needsAttention = blockingReasons.length > 0;
  const [note, setNote] = useState(collaborationNote);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!onSaveNote) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await onSaveNote(note);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="oma-review-cues oma-card" aria-label={t('brand.review.label')}>
      <h3>{t('brand.review.title')}</h3>
      <p>
        <span className="oma-badge">{status}</span>
      </p>
      {needsAttention ? (
        <div role="status">
          <p className="oma-muted">{t('brand.review.needsAttention')}</p>
          <ul>
            {blockingReasons.map((reason) => (
              <li key={reason}>{t(`brand.blocking.${reason}`)}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="oma-muted" role="status">
          {t('brand.review.ready')}
        </p>
      )}

      {onSaveNote ? (
        <form className="oma-stack" onSubmit={save}>
          <label className="oma-field">
            <span>{t('brand.review.noteLabel')}</span>
            <TextArea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={busy}
            />
          </label>
          <Button type="default" disabled={busy} htmlType="submit">
            {t('brand.review.noteSave')}
          </Button>
          {saved ? (
            <p role="status" className="oma-muted">
              {t('brand.review.noteSaved')}
            </p>
          ) : null}
          {error ? (
            <p role="alert" style={{ color: 'var(--status-danger)' }}>
              {error}
            </p>
          ) : null}
        </form>
      ) : null}

      <div>
        <h4>{t('brand.review.historyTitle')}</h4>
        {reviewHistory.length === 0 ? (
          <p className="oma-muted">{t('brand.review.historyEmpty')}</p>
        ) : (
          <ul>
            {reviewHistory.map((item) => (
              <li key={item.id}>
                <span className="oma-badge">{item.kind}</span> {item.action}{' '}
                <span className="oma-muted">{new Date(item.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
