'use client';

import { Button } from '@oma/ui/controls';
import { useT } from '../../lib/use-locale';

type AiUnavailableBannerProps = {
  aiAvailability: string;
  analysisStatus?: string | null;
  analysisErrorCode?: string | null;
  budgetExhausted?: boolean;
  /** From GET /api/v1/ai/status — whether the API can queue live analysis / strategy AI. */
  platformAvailability?: 'AVAILABLE' | 'NOT_CONFIGURED' | 'BUDGET_EXHAUSTED' | null;
  canRequestAnalysis?: boolean;
  onRequestAnalysis?: () => void;
  requestBusy?: boolean;
};

export function AiUnavailableBanner({
  aiAvailability,
  analysisStatus,
  analysisErrorCode,
  budgetExhausted,
  platformAvailability,
  canRequestAnalysis,
  onRequestAnalysis,
  requestBusy,
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
        {platformAvailability === 'AVAILABLE' && canRequestAnalysis && onRequestAnalyze(onRequestAnalysis, requestBusy, t)}
      </div>
    );
  }

  if (analysisStatus === 'SKIPPED' || analysisStatus === 'NOT_REQUESTED') {
    if (platformAvailability === 'AVAILABLE' && canRequestAnalysis && onRequestAnalysis) {
      return (
        <div className="oma-banner oma-banner-info" role="status" data-testid="ai-analysis-status">
          <strong>{t('brand.ai.pendingTitle')}</strong>
          <p>
            {analysisErrorCode === 'PLAN_FEATURE_REQUIRED'
              ? t('brand.ai.planRequiredBody')
              : analysisErrorCode === 'AI_NOT_CONFIGURED'
                ? t('brand.ai.workerSetupBody')
                : t('brand.ai.pendingBody')}
          </p>
          {onRequestAnalyze(onRequestAnalysis, requestBusy, t)}
        </div>
      );
    }
  }

  if (budgetExhausted || platformAvailability === 'BUDGET_EXHAUSTED') {
    return (
      <div className="oma-banner oma-banner-warning" role="status" data-testid="ai-budget-banner">
        <strong>{t('brand.ai.budgetTitle')}</strong>
        <p>{t('brand.ai.budgetBody')}</p>
      </div>
    );
  }

  if (aiAvailability !== 'NOT_CONFIGURED' && aiAvailability !== 'UNAVAILABLE') return null;

  return (
    <div className="oma-banner oma-banner-warning" role="status" data-testid="ai-analysis-status">
      <strong>{t('brand.ai.unavailableTitle')}</strong>
      <p>
        {platformAvailability === 'AVAILABLE'
          ? t('brand.ai.workerSetupBody')
          : t('brand.ai.unavailableBody')}
      </p>
      <p className="oma-muted">{t('brand.ai.setupChecklist')}</p>
      {platformAvailability === 'AVAILABLE' && canRequestAnalysis && onRequestAnalyze(onRequestAnalysis, requestBusy, t)}
    </div>
  );
}

function onRequestAnalyze(
  onRequestAnalysis: (() => void) | undefined,
  requestBusy: boolean | undefined,
  t: (key: string) => string,
) {
  if (!onRequestAnalysis) return null;
  return (
    <div className="oma-form-actions">
      <Button type="primary" disabled={requestBusy} onClick={() => onRequestAnalysis()}>
        {t('brand.ai.rerun')}
      </Button>
    </div>
  );
}