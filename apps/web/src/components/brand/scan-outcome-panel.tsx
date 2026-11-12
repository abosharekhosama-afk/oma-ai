'use client';

import type { ScanDetail } from '../../lib/brand-types';
import { crawlPhaseComplete, scanTerminal } from '../../lib/brand-scan-ui';
import { StatusChip } from '../ui/status-chip';
import { useT } from '../../lib/use-locale';

type Props = {
  scan: ScanDetail;
  compact?: boolean;
};

function analysisLabel(t: (k: string) => string, status?: string | null): string {
  if (!status || status === 'NOT_REQUESTED' || status === 'SKIPPED') {
    return t('brand.scan.outcome.ai.notRun');
  }
  const key = `brand.scan.outcome.ai.${status}`;
  const translated = t(key);
  return translated.startsWith('brand.scan.outcome.ai.') ? status : translated;
}

export function ScanOutcomePanel({ scan, compact }: Props) {
  const t = useT();
  const crawlKey = `brand.scan.outcome.crawl.${scan.status}`;
  const crawlLabel = t(crawlKey).startsWith('brand.scan.outcome.crawl.')
    ? scan.status
    : t(crawlKey);
  const aiStatus = scan.analysis_status ?? null;
  const terminal = scanTerminal(scan);
  const crawlDone = crawlPhaseComplete(scan);

  return (
    <section
      className={
        compact ? 'oma-scan-outcome oma-scan-outcome--compact' : 'oma-scan-outcome oma-panel'
      }
      data-testid="scan-outcome-panel"
      aria-labelledby="scan-outcome-title"
    >
      {!compact ? <h2 id="scan-outcome-title">{t('brand.scan.outcomeTitle')}</h2> : null}
      <dl className="oma-scan-outcome__grid">
        <div>
          <dt>{t('brand.scan.crawlOutcomeLabel')}</dt>
          <dd>
            <StatusChip status={scan.status} label={crawlLabel} />
            {terminal ? (
              <p className="oma-muted">{t('brand.scan.crawlOutcomeHint')}</p>
            ) : (
              <p className="oma-muted">{t('brand.scan.crawlInProgressHint')}</p>
            )}
          </dd>
        </div>
        <div>
          <dt>{t('brand.scan.aiOutcomeLabel')}</dt>
          <dd>
            <span className="oma-badge" data-testid="scan-analysis-status-readable">
              {analysisLabel(t, aiStatus)}
            </span>
            {aiStatus === 'FAILED' ? (
              <p className="oma-muted">
                {t('brand.scan.aiFailedHint')}
                {scan.analysis_error_code ? ` (${scan.analysis_error_code})` : ''}
              </p>
            ) : null}
            {aiStatus === 'ANALYZED' ? (
              <p className="oma-muted">{t('brand.scan.aiSuccessHint')}</p>
            ) : null}
          </dd>
        </div>
        <div>
          <dt>{t('brand.scan.pipelineProgressLabel')}</dt>
          <dd>
            <strong>{scan.progress_percent}%</strong>
            <p className="oma-muted">
              {crawlDone
                ? t('brand.scan.pipelineProgressDone')
                : t('brand.scan.pipelineProgressActive')}
            </p>
          </dd>
        </div>
      </dl>
    </section>
  );
}
