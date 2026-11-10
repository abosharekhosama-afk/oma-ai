'use client';

import { useT } from '../../lib/use-locale';

type AiUnavailableBannerProps = {
  aiAvailability: string;
  analysisStatus?: string | null;
  analysisErrorCode?: string | null;
  budgetExhausted?: boolean;
};

export function AiUnavailableBanner({
  aiAvailability,
  analysisStatus,
  analysisErrorCode,
  budgetExhausted,
}: AiUnavailableBannerProps) {
  const t = useT();

  if (analysisStatus === 'QUEUED' || analysisStatus === 'ANALYZING') {
    return (
      <div className="oma-banner oma-banner-info" role="status" data-testid="ai-analysis-status">
        <strong>{t('brand.ai.analyzingTitle')}</strong>
        <p>{t('brand.ai.analyzingBody')}</p>
      </div>
    );
  }

  if (analysisStatus === 'ANALYZED') {
    return (
      <div className="oma-banner oma-banner-info" role="status" data-testid="ai-analysis-status">
        <strong>{t('brand.ai.analyzedTitle')}</strong>
        <p>{t('brand.ai.analyzedBody')}</p>
      </div>
    );
  }

  if (analysisStatus === 'FAILED') {
    return (
      <div className="oma-banner oma-banner-warning" role="status" data-testid="ai-analysis-status">
        <strong>{t('brand.ai.failedTitle')}</strong>
        <p>{t('brand.ai.failedBody')}</p>
        {analysisErrorCode ? <p className="oma-muted">{analysisErrorCode}</p> : null}
      </div>
    );
  }

  if (budgetExhausted) {
    return (
      <div className="oma-banner oma-banner-warning" role="status" data-testid="ai-budget-banner">
        <strong>{t('brand.ai.budgetTitle')}</strong>
        <p>{t('brand.ai.budgetBody')}</p>
      </div>
    );
  }

  if (aiAvailability !== 'NOT_CONFIGURED' && aiAvailability !== 'UNAVAILABLE') return null;

  return (
    <div className="oma-banner oma-banner-warning" role="status">
      <strong>{t('brand.ai.unavailableTitle')}</strong>
      <p>{t('brand.ai.unavailableBody')}</p>
    </div>
  );
}
