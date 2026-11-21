import type { BrandPipelineHints } from './brand-pipeline-hints';
import { hasBrandContent, hasPlanRequestsCommitted } from './brand-pipeline-hints';
import type { BrandDetail } from './brand-types';

export type JourneyStepState = 'done' | 'current' | 'todo';

export type JourneyStep = {
  id: string;
  label: string;
  state: JourneyStepState;
};

export function buildBrandJourneySteps(
  brand: BrandDetail,
  t: (key: string) => string,
  hints?: BrandPipelineHints | null,
): JourneyStep[] {
  const scan = brand.latest_scan;
  const profileApproved = Boolean(brand.current_approved_profile_version_id);
  const strategyActive = Boolean(brand.current_approved_strategy_id);
  const planDone = hasPlanRequestsCommitted(hints);
  const contentDone = hasBrandContent(hints);

  const connect: JourneyStep = {
    id: 'connect',
    label: t('brand.detail.journeyConnect'),
    state: brand.website ? 'done' : 'current',
  };

  const scanStep: JourneyStep = {
    id: 'scan',
    label: t('brand.detail.journeyScan'),
    state: scan ? 'done' : brand.website ? 'current' : 'todo',
  };

  const discover: JourneyStep = {
    id: 'discover',
    label: t('brand.detail.journeyDiscover'),
    state: scan ? (profileApproved ? 'done' : 'current') : 'todo',
  };

  const intel: JourneyStep = {
    id: 'intel',
    label: t('brand.detail.journeyIntelligence'),
    state: profileApproved ? 'done' : scan ? 'current' : 'todo',
  };

  const strategy: JourneyStep = {
    id: 'strategy',
    label: t('brand.detail.journeyStrategy'),
    state: profileApproved ? (strategyActive ? 'done' : 'current') : 'todo',
  };

  const plan: JourneyStep = {
    id: 'plan',
    label: t('brand.detail.journeyPlan'),
    state: !strategyActive ? 'todo' : planDone ? 'done' : strategyActive ? 'current' : 'todo',
  };

  const content: JourneyStep = {
    id: 'content',
    label: t('brand.detail.journeyContent'),
    state: !strategyActive ? 'todo' : contentDone ? 'done' : planDone ? 'current' : 'todo',
  };

  return [connect, scanStep, discover, intel, strategy, plan, content];
}

export function brandPrimaryNextStep(
  brandId: string,
  brand: BrandDetail,
  t: (key: string) => string,
  hints?: BrandPipelineHints | null,
): { href: string; label: string } {
  if (!brand.website) {
    return { href: `/app/brands/${brandId}/connect`, label: t('brand.detail.connectCta') };
  }
  if (!brand.latest_scan) {
    return { href: `/app/brands/${brandId}/scans/new`, label: t('brand.scan.start') };
  }
  if (!brand.current_approved_profile_version_id) {
    if (
      brand.latest_scan &&
      (brand.latest_scan.status === 'SUCCEEDED' || brand.latest_scan.status === 'PARTIAL')
    ) {
      return {
        href: `/app/brands/${brandId}/discovery`,
        label: t('brand.detail.discoveryCta'),
      };
    }
    return { href: `/app/brands/${brandId}/profiles`, label: t('brand.detail.intelligenceCta') };
  }
  if (!brand.current_approved_strategy_id) {
    return {
      href: `/app/brands/${brandId}/strategies/new`,
      label: t('brand.detail.createStrategyCta'),
    };
  }
  const strategyId = brand.current_approved_strategy_id;
  if (!hasPlanRequestsCommitted(hints)) {
    return {
      href: `/app/brands/${brandId}/strategies/${strategyId}/review`,
      label: t('brand.detail.planRequestsCta'),
    };
  }
  if (!hasBrandContent(hints)) {
    return {
      href: `/app/content`,
      label: t('brand.detail.contentCalendarCta'),
    };
  }
  return {
    href: `/app/brands/${brandId}/strategies/${strategyId}`,
    label: t('brand.detail.openStrategyCta'),
  };
}
