'use client';

import type { ReactNode } from 'react';
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
  const apiReady = platformAvailability === 'AVAILABLE';
  const workerMissing = aiAvailability === 'NOT_CONFIGURED' || aiAvailability === 'UNAVAILABLE';

  const action =
    canRequestAnalysis && onRequestAnalysis ? (
      <Button
        type="primary"
        size="small"
        disabled={requestBusy}
        onClick={() => onRequestAnalysis()}
      >
        {t('brand.ai.rerun')}
      </Button>
    ) : null;

  if (analysisStatus === 'QUEUED' || analysisStatus === 'ANALYZING') {
    return (
      <AiStrip variant="info" testId="ai-analysis-status">
        <strong>{t('brand.ai.analyzingTitle')}</strong>
        <p>{t('brand.ai.analyzingBody')}</p>
      </AiStrip>
    );
  }

  if (analysisStatus === 'ANALYZED') {
    return (
      <AiStrip variant="info" testId="ai-analysis-status">
        <strong>{t('brand.ai.analyzedTitle')}</strong>
        <p>{t('brand.ai.analyzedBody')}</p>
      </AiStrip>
    );
  }

  if (analysisStatus === 'FAILED') {
    return (
      <AiStrip variant="warning" testId="ai-analysis-status" action={apiReady ? action : null}>
        <strong>{t('brand.ai.failedTitle')}</strong>
        <p>{t('brand.ai.failedBody')}</p>
        {analysisErrorCode ? <p className="oma-muted">{analysisErrorCode}</p> : null}
      </AiStrip>
    );
  }

  if (analysisStatus === 'SKIPPED' || analysisStatus === 'NOT_REQUESTED') {
    if (apiReady && workerMissing) {
      return null;
    }
    if (apiReady && canRequestAnalysis && onRequestAnalysis) {
      return (
        <AiStrip variant="info" testId="ai-analysis-status" action={action}>
          <strong>{t('brand.ai.pendingTitle')}</strong>
          <p>
            {analysisErrorCode === 'PLAN_FEATURE_REQUIRED'
              ? t('brand.ai.planRequiredBody')
              : analysisErrorCode === 'AI_NOT_CONFIGURED'
                ? t('brand.ai.pendingBody')
                : t('brand.ai.pendingBody')}
          </p>
        </AiStrip>
      );
    }
  }

  if (budgetExhausted || platformAvailability === 'BUDGET_EXHAUSTED') {
    return (
      <AiStrip variant="warning" testId="ai-budget-banner">
        <strong>{t('brand.ai.budgetTitle')}</strong>
        <p>{t('brand.ai.budgetBody')}</p>
      </AiStrip>
    );
  }

  if (!workerMissing) return null;

  if (apiReady) {
    return null;
  }

  return (
    <AiStrip variant="muted" testId="ai-analysis-status">
      <strong>{t('brand.ai.manualTitle')}</strong>
      <p>{t('brand.ai.unavailableBody')}</p>
    </AiStrip>
  );
}

function AiStrip({
  variant,
  testId,
  action,
  children,
}: {
  variant: 'info' | 'warning' | 'muted';
  testId: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const klass =
    variant === 'warning'
      ? 'oma-plx-brand-ai-strip oma-plx-brand-ai-strip--warning'
      : variant === 'muted'
        ? 'oma-plx-brand-ai-strip oma-plx-brand-ai-strip--muted'
        : 'oma-plx-brand-ai-strip';
  return (
    <div className={klass} role="status" data-testid={testId}>
      <div className="oma-plx-brand-ai-strip__copy">{children}</div>
      {action ? <div className="oma-plx-brand-ai-strip__actions">{action}</div> : null}
    </div>
  );
}
