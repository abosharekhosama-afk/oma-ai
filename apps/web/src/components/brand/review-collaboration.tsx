'use client';

import { useT } from '../../lib/use-locale';

type ReviewCollaborationProps = {
  status: string;
  blockingReasons: string[];
};

export function ReviewCollaboration({ status, blockingReasons }: ReviewCollaborationProps) {
  const t = useT();
  const needsAttention = blockingReasons.length > 0;

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
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="oma-muted" role="status">
          {t('brand.review.ready')}
        </p>
      )}
    </aside>
  );
}
