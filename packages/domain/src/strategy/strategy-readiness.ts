/**
 * Strategy readiness + guided journey (pure, browser-safe).
 *
 * Every submit/approve blocking code maps to the exact place in the strategy
 * workspace where the user fixes it, so the UI can list plain-language items
 * instead of a generic "can't be approved yet" error.
 */

export type StrategyFixSection =
  'evidence' | 'foundation' | 'tracks' | 'organic' | 'paid' | 'review';

export type StrategyBlockingItem = {
  code: string;
  section: StrategyFixSection;
  /** Path under `/app/brands/:brandId/strategies/:strategyId` (may carry an #anchor). */
  fix_path: string;
};

const FIX_TARGETS: Record<string, { section: StrategyFixSection; fix_path: string }> = {
  APPROVED_PROFILE_REQUIRED: { section: 'evidence', fix_path: '/review#strategy-link-profile' },
  LINKED_PROFILE_NOT_APPROVED: { section: 'evidence', fix_path: '/review#strategy-link-profile' },
  FOUNDATION_GOALS_REQUIRED: { section: 'foundation', fix_path: '/edit#strategy-goals' },
  FOUNDATION_POSITIONING_REQUIRED: {
    section: 'foundation',
    fix_path: '/edit#strategy-positioning',
  },
  REQUIRED_FOUNDATION_FIELDS: { section: 'foundation', fix_path: '/edit#strategy-goals' },
  NO_TRACK_ENABLED: { section: 'tracks', fix_path: '/edit#strategy-tracks' },
  ORGANIC_DISABLED_RATIONALE_REQUIRED: { section: 'tracks', fix_path: '/edit#strategy-tracks' },
  PAID_DISABLED_RATIONALE_REQUIRED: { section: 'tracks', fix_path: '/edit#strategy-tracks' },
  PAID_BUDGET_REQUIRED: { section: 'paid', fix_path: '/paid' },
  PAID_ALLOCATIONS_REQUIRED: { section: 'paid', fix_path: '/paid' },
  PAID_AUDIENCE_REQUIRED: { section: 'paid', fix_path: '/paid' },
  PAID_ALLOCATION_NOT_100: { section: 'paid', fix_path: '/paid' },
  PAID_DUPLICATE_ALLOCATION: { section: 'paid', fix_path: '/paid' },
  PAID_DUPLICATE_AUDIENCE: { section: 'paid', fix_path: '/paid' },
  PAID_AUDIENCE_AGE_INVALID: { section: 'paid', fix_path: '/paid' },
  PAID_EXPERIMENT_AUDIENCE_UNKNOWN: { section: 'paid', fix_path: '/paid' },
  PAID_EXPERIMENT_VARIANT_INVALID: { section: 'paid', fix_path: '/paid' },
  UNKNOWNS_ACK_REQUIRED: { section: 'review', fix_path: '/review#strategy-unknowns' },
};

/** Every blocking code the readiness UI knows how to explain (i18n `strategy.blocker.<CODE>`). */
export const STRATEGY_BLOCKING_CODES = Object.keys(FIX_TARGETS);

export function strategyBlockingItem(code: string): StrategyBlockingItem {
  const target = FIX_TARGETS[code] ?? { section: 'review' as const, fix_path: '/review' };
  return { code, ...target };
}

export type FoundationCheck = {
  hasGoals: boolean;
  hasPositioning: boolean;
};

function textOf(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object' && 'value' in value) {
    const v = (value as { value?: unknown }).value;
    return typeof v === 'string' ? v.trim() : '';
  }
  return '';
}

/** Goals + positioning are the two required foundation fields (submit gate). */
export function checkFoundation(
  foundation: Record<string, unknown> | null | undefined,
): FoundationCheck {
  const f = foundation ?? {};
  const goals = f.goals;
  const hasGoals = Array.isArray(goals)
    ? goals.some((g) => textOf(g).length > 0)
    : textOf(goals).length > 0;
  return { hasGoals, hasPositioning: textOf(f.positioning).length > 0 };
}

/**
 * Replace the coarse REQUIRED_FOUNDATION_FIELDS code with the specific missing
 * field(s) so the user knows exactly which box to fill.
 */
export function expandFoundationReasons(reasons: string[], check: FoundationCheck): string[] {
  const out: string[] = [];
  for (const code of reasons) {
    if (code !== 'REQUIRED_FOUNDATION_FIELDS') {
      out.push(code);
      continue;
    }
    if (!check.hasGoals) out.push('FOUNDATION_GOALS_REQUIRED');
    if (!check.hasPositioning) out.push('FOUNDATION_POSITIONING_REQUIRED');
    if (check.hasGoals && check.hasPositioning) out.push(code);
  }
  return [...new Set(out)];
}

export type StrategyJourneyStepId = 'foundation' | 'plan' | 'submit' | 'approve' | 'execute';
export type StrategyJourneyState = 'done' | 'current' | 'todo';

export type StrategyJourneyInput = {
  versionStatus: string;
  foundation: FoundationCheck;
  /** Organic plan has pillars or a posting cadence, or the paid plan has allocations. */
  planHasContent: boolean;
  /** Work was already sent to the calendar / briefs from the approved version. */
  executionStarted?: boolean;
};

export type StrategyJourney = {
  current: StrategyJourneyStepId | null;
  steps: Array<{ id: StrategyJourneyStepId; state: StrategyJourneyState }>;
};

const ORDER: StrategyJourneyStepId[] = ['foundation', 'plan', 'submit', 'approve', 'execute'];

/**
 * The five-step guided flow shown at the top of every strategy page:
 * 1 foundation → 2 plan (AI or manual) → 3 review & submit → 4 approve → 5 calendar/briefs.
 */
export function strategyJourney(input: StrategyJourneyInput): StrategyJourney {
  const status = input.versionStatus;
  const done: Record<StrategyJourneyStepId, boolean> = {
    foundation: input.foundation.hasGoals && input.foundation.hasPositioning,
    plan: input.planHasContent,
    submit: status === 'IN_REVIEW' || status === 'APPROVED' || status === 'SUPERSEDED',
    approve: status === 'APPROVED' || status === 'SUPERSEDED',
    execute: Boolean(input.executionStarted),
  };
  if (status !== 'DRAFT') {
    // Past the draft stage the content steps are frozen; treat them as done.
    done.foundation = true;
    done.plan = true;
  }
  let current: StrategyJourneyStepId | null = null;
  if (status === 'CHANGES_REQUESTED' || status === 'REJECTED') {
    // A new draft (Revise) is needed before anything else can move.
    current = 'submit';
  } else if (status === 'IN_REVIEW') {
    current = 'approve';
  } else if (status === 'DRAFT') {
    current = ORDER.find((id) => id !== 'approve' && id !== 'execute' && !done[id]) ?? 'submit';
  } else if (status === 'APPROVED') {
    current = done.execute ? null : 'execute';
  }
  return {
    current,
    steps: ORDER.map((id) => ({
      id,
      state: id === current ? 'current' : done[id] ? 'done' : 'todo',
    })),
  };
}
