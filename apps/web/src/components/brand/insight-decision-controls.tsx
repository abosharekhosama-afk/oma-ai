'use client';

import type { InsightItem } from '../../lib/brand-types';
import { useT } from '../../lib/use-locale';

type InsightDecisionControlsProps = {
  insight: InsightItem;
  profileRowVersion: number;
  disabled?: boolean;
  onAccept: (insightId: string) => Promise<void>;
  onReject: (insightId: string) => Promise<void>;
};

export function InsightDecisionControls({
  insight,
  disabled,
  onAccept,
  onReject,
}: InsightDecisionControlsProps) {
  const t = useT();
  const pending = insight.info_state === 'AI_INFERRED' && insight.review_status === 'PENDING';

  if (!pending) {
    return (
      <span className="oma-badge" aria-label={t('brand.insight.status')}>
        {insight.review_status}
      </span>
    );
  }

  return (
    <div className="oma-insight-decisions" role="group" aria-label={t('brand.insight.decide')}>
      <button
        type="button"
        className="oma-btn"
        disabled={disabled}
        onClick={() => void onAccept(insight.id)}
      >
        {t('brand.insight.accept')}
      </button>
      <button
        type="button"
        className="oma-btn-secondary"
        disabled={disabled}
        onClick={() => void onReject(insight.id)}
      >
        {t('brand.insight.reject')}
      </button>
    </div>
  );
}
