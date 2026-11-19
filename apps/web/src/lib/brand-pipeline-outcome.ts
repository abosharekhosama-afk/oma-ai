import type { BrandPipelineHints } from './brand-pipeline-hints';
import { hasBrandContent, hasPlanRequestsCommitted } from './brand-pipeline-hints';
import type { BrandDetail, ScanDetail } from './brand-types';

export type PipelineStage = {
  id: string;
  label: string;
  detail: string;
  href: string;
  state: 'done' | 'current' | 'todo' | 'blocked';
};

export function buildBrandPipelineStages(
  brandId: string,
  brand: BrandDetail,
  scan: ScanDetail | null,
  t: (key: string) => string,
  hints?: BrandPipelineHints | null,
): PipelineStage[] {
  const scanDone =
    scan && (scan.status === 'SUCCEEDED' || scan.status === 'PARTIAL' || scan.status === 'FAILED');
  const summary = scan?.discovery_summary;
  const profileId = scan?.profile_version_id ?? brand.latest_profile_version_id ?? null;
  const analysisDone = scan?.analysis_status === 'ANALYZED';
  const analysisActive =
    scan?.analysis_status === 'QUEUED' || scan?.analysis_status === 'ANALYZING';
  const analysisOk = analysisDone || scan?.analysis_status === 'SKIPPED';
  const profileApproved = Boolean(brand.current_approved_profile_version_id);
  const strategyReady = Boolean(brand.current_approved_strategy_id);
  const strategyId = brand.current_approved_strategy_id;
  const planDone = hasPlanRequestsCommitted(hints);
  const contentDone = hasBrandContent(hints);

  const discoveryDetail = summary
    ? t('brand.pipeline.discoveryDetail')
        .replace('{pages}', String(summary.pages))
        .replace('{products}', String(summary.products))
        .replace('{services}', String(summary.services))
    : scanDone
      ? t('brand.pipeline.discoveryDetailUnknown')
      : t('brand.pipeline.discoveryTodo');

  const maxPages = scan?.coverage?.scan_max_pages ?? scan?.pages_fetched ?? 0;
  const scanDetail = scan
    ? t('brand.pipeline.scanDetail')
        .replace('{fetched}', String(scan.pages_fetched))
        .replace('{max}', String(maxPages || '—'))
        .replace('{status}', scan.status)
    : t('brand.pipeline.scanTodo');

  const planReviewHref = strategyId
    ? `/app/brands/${brandId}/strategies/${strategyId}/review`
    : `/app/brands/${brandId}/strategies/new`;

  const planState: PipelineStage['state'] = !strategyReady
    ? 'blocked'
    : planDone
      ? 'done'
      : 'current';

  const contentState: PipelineStage['state'] = !strategyReady
    ? 'blocked'
    : contentDone
      ? 'done'
      : planDone
        ? 'current'
        : 'todo';

  const requestCount = hints?.work_request_count ?? 0;
  const contentCount = hints?.content_count ?? 0;

  return [
    {
      id: 'scan',
      label: t('brand.pipeline.scan'),
      detail: scanDetail,
      href: scan ? `/app/brands/${brandId}/scans/${scan.id}` : `/app/brands/${brandId}/scans/new`,
      state: scanDone ? 'done' : scan ? 'current' : brand.website ? 'current' : 'blocked',
    },
    {
      id: 'discovery',
      label: t('brand.pipeline.discovery'),
      detail: discoveryDetail,
      href: `/app/brands/${brandId}/discovery`,
      state: scanDone ? (profileApproved ? 'done' : 'current') : 'todo',
    },
    {
      id: 'intelligence',
      label: t('brand.pipeline.intelligence'),
      detail: analysisDone
        ? t('brand.pipeline.intelligenceDone')
        : analysisActive
          ? t('brand.pipeline.intelligenceRunning')
          : scanDone
            ? t('brand.pipeline.intelligenceTodo')
            : t('brand.pipeline.intelligenceBlocked'),
      href: profileId
        ? `/app/brands/${brandId}/profiles/${profileId}`
        : scan
          ? `/app/brands/${brandId}/scans/${scan.id}`
          : `/app/brands/${brandId}/scans/new`,
      state: !scanDone ? 'blocked' : analysisDone ? 'done' : scanDone ? 'current' : 'todo',
    },
    {
      id: 'profile',
      label: t('brand.pipeline.profile'),
      detail: profileApproved
        ? t('brand.pipeline.profileApproved')
        : analysisDone
          ? t('brand.pipeline.profileReview')
          : profileId
            ? analysisOk
              ? t('brand.pipeline.profileDraft')
              : t('brand.pipeline.profileAwaitAnalysis')
            : t('brand.pipeline.profileTodo'),
      href: profileId
        ? `/app/brands/${brandId}/profiles/${profileId}`
        : `/app/brands/${brandId}/profiles`,
      state: profileApproved ? 'done' : analysisDone ? 'current' : scanDone ? 'todo' : 'blocked',
    },
    {
      id: 'strategy',
      label: t('brand.pipeline.strategy'),
      detail: strategyReady
        ? t('brand.pipeline.strategyDone')
        : profileApproved
          ? t('brand.pipeline.strategyBuild')
          : t('brand.pipeline.strategyBlocked'),
      href: strategyId
        ? `/app/brands/${brandId}/strategies/${strategyId}`
        : `/app/brands/${brandId}/strategies/new`,
      state: strategyReady ? 'done' : profileApproved ? 'current' : 'blocked',
    },
    {
      id: 'plan_requests',
      label: t('brand.pipeline.planRequests'),
      detail: !strategyReady
        ? t('brand.pipeline.planRequestsBlocked')
        : planDone
          ? t('brand.pipeline.planRequestsDone').replace('{count}', String(requestCount))
          : t('brand.pipeline.planRequestsBuild'),
      href: planReviewHref,
      state: planState,
    },
    {
      id: 'content',
      label: t('brand.pipeline.content'),
      detail: !strategyReady
        ? t('brand.pipeline.contentBlocked')
        : contentDone
          ? t('brand.pipeline.contentDone').replace('{count}', String(contentCount))
          : planDone
            ? t('brand.pipeline.contentBuild')
            : t('brand.pipeline.contentAwaitPlan'),
      href: `/app/content`,
      state: contentState,
    },
  ];
}

export function pipelineEndGoal(
  t: (key: string) => string,
  brand: BrandDetail,
  hints?: BrandPipelineHints | null,
): string {
  if (hasBrandContent(hints)) {
    return t('brand.pipeline.endGoalContentLive');
  }
  if (hasPlanRequestsCommitted(hints)) {
    return t('brand.pipeline.endGoalContentCalendar');
  }
  if (brand.current_approved_strategy_id) {
    return t('brand.pipeline.endGoalPlanRequests');
  }
  if (brand.current_approved_profile_version_id) {
    return t('brand.pipeline.endGoalBuildStrategy');
  }
  if (brand.latest_scan) {
    return t('brand.pipeline.endGoalApproveProfile');
  }
  return t('brand.pipeline.endGoalScan');
}
