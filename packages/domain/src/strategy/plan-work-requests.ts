import {
  DEFAULT_MAX_CATALOG_PAID_PRODUCT_REQUESTS,
  DEFAULT_MAX_CATALOG_PRODUCT_REQUESTS,
  DEFAULT_MAX_CATALOG_SERVICE_REQUESTS,
  type CatalogOffering,
} from '../brand/catalog-offerings';
import type { OrganicPlanInput, PaidPlanInput } from './tracks-v2';

export type PlanWorkRequestDraft = {
  plan_source_key: string;
  track: 'organic' | 'paid';
  title: { en: string; ar: string };
  description: { en: string; ar: string };
  channels: string[];
  formats: string[];
  brief: {
    objective: { en: string; ar: string };
    audience: { en: string; ar: string };
    keyMessage: { en: string; ar: string };
  };
};

function readLabel(item: unknown): string {
  if (typeof item === 'string') return item.trim();
  if (item && typeof item === 'object') {
    const record = item as Record<string, unknown>;
    if (typeof record.value === 'string') return record.value.trim();
    if (typeof record.name === 'string') return record.name.trim();
    if (typeof record.label === 'string') return record.label.trim();
  }
  return '';
}

function pair(text: string): { en: string; ar: string } {
  const trimmed = text.trim();
  return { en: trimmed, ar: trimmed };
}

/**
 * Pillars backfilled from legacy JSON are keyed `legacy-<n>` (1-based); keep the
 * pre-4.1 `organic:pillar:<index>` source key so re-running conversion stays idempotent.
 */
export function pillarSourceKey(key: string): string {
  const legacy = /^legacy-(\d+)$/.exec(key);
  return legacy ? `organic:pillar:${Number(legacy[1]) - 1}` : `organic:pillar:${key}`;
}

export function buildPlanWorkRequestDrafts(input: {
  strategyName: string;
  foundation: Record<string, unknown>;
  organicEnabled: boolean;
  paidEnabled: boolean;
  organic: {
    pillars?: unknown[];
    channels?: unknown[];
    formats?: unknown[];
    growth_goals?: string | null;
    message_cta?: string | null;
  } | null;
  paid: {
    campaign_objectives?: unknown[];
    formats?: unknown[];
    offer_angle?: string | null;
  } | null;
  audiences: Array<{ name: string; description?: string | null }>;
  catalogOfferings?: CatalogOffering[];
  /**
   * Tracks v2 organic plan (DEC-029 4.1): the source of truth for pillars and cadence.
   * Legacy `organic.pillars/channels/formats` are only read when v2 has none.
   */
  organicPlan?: OrganicPlanInput | null;
  /** Tracks v2 paid plan (DEC-021); preferred over legacy objectives when present. */
  paidPlan?: PaidPlanInput | null;
  paidBudgetAmount?: number | null;
}): PlanWorkRequestDraft[] {
  const goals = Array.isArray(input.foundation.goals) ? input.foundation.goals : [];
  const keyMessages = Array.isArray(input.foundation.keyMessages)
    ? input.foundation.keyMessages
    : [];
  const positioning =
    readLabel(input.foundation.positioning) ||
    (typeof input.foundation.positioning === 'object'
      ? readLabel((input.foundation.positioning as Record<string, unknown>).value)
      : '');
  const primaryGoal = readLabel(goals[0]) || 'Deliver the approved organic/paid plan';
  const primaryMessage = readLabel(keyMessages[0]) || positioning || input.strategyName;
  const planAudiences = input.paidPlan?.audiences ?? [];
  const audienceName =
    planAudiences[0]?.name?.trim() || input.audiences[0]?.name?.trim() || 'Primary audience';
  const audienceText =
    planAudiences[0]?.description?.trim() ||
    input.audiences[0]?.description?.trim() ||
    audienceName;

  const out: PlanWorkRequestDraft[] = [];

  const v2Pillars = input.organicPlan?.pillars ?? [];
  const v2Cadence = input.organicPlan?.cadence ?? [];
  const legacyChannels = (input.organic?.channels ?? []).map(readLabel).filter(Boolean);
  const legacyFormats = (input.organic?.formats ?? []).map(readLabel).filter(Boolean);
  const activeCadence = v2Cadence.filter((c) => c.posts_per_week > 0);
  const organicChannels = activeCadence.length
    ? activeCadence.map((c) => c.channel)
    : legacyChannels;
  const organicFormats = activeCadence.length
    ? [...new Set(activeCadence.flatMap((c) => c.formats))]
    : legacyFormats;

  if (input.organicEnabled && v2Pillars.length > 0) {
    const growth = input.organic?.growth_goals?.trim() || '';
    for (const pillar of v2Pillars) {
      const description = pillar.description?.trim() || growth || pillar.name_en;
      out.push({
        plan_source_key: pillarSourceKey(pillar.key),
        track: 'organic',
        title: {
          en: `${input.strategyName} — ${pillar.name_en}`,
          ar: `${input.strategyName} — ${pillar.name_ar}`,
        },
        description: pair(description),
        channels: organicChannels,
        formats: organicFormats,
        brief: {
          objective: pair(primaryGoal),
          audience: pair(audienceText),
          keyMessage: { en: pillar.name_en, ar: pillar.name_ar },
        },
      });
    }
  } else if (input.organicEnabled && input.organic) {
    const pillars = (input.organic.pillars ?? []).map(readLabel).filter(Boolean);
    const growth = input.organic.growth_goals?.trim() || '';
    const items = pillars.length > 0 ? pillars : ['Organic content plan'];
    for (let i = 0; i < items.length; i += 1) {
      const pillar = items[i]!;
      out.push({
        plan_source_key: `organic:pillar:${i}`,
        track: 'organic',
        title: pair(`${input.strategyName} — ${pillar}`),
        description: pair(growth || pillar),
        channels: organicChannels,
        formats: organicFormats,
        brief: {
          objective: pair(primaryGoal),
          audience: pair(audienceText),
          keyMessage: pair(pillar || primaryMessage),
        },
      });
    }
  }

  const catalog = input.catalogOfferings ?? [];
  const catalogProducts = catalog.filter((item) => item.kind === 'product');
  const catalogServices = catalog.filter((item) => item.kind === 'service');

  if (input.organicEnabled && catalog.length > 0) {
    const channels =
      organicChannels.length || input.organic || activeCadence.length
        ? organicChannels
        : ['Social', 'Web'];
    const formats =
      organicFormats.length || input.organic || activeCadence.length
        ? organicFormats
        : ['Post', 'Story'];
    const productCap = Math.min(catalogProducts.length, DEFAULT_MAX_CATALOG_PRODUCT_REQUESTS);
    for (const product of catalogProducts.slice(0, productCap)) {
      const focus = product.category ? `${product.name} (${product.category})` : product.name;
      const mediaNote = product.primary_media_view_url
        ? ` Use approved catalog product media in WorkDrive as the visual anchor.`
        : '';
      const desc =
        (product.description?.trim() ||
          `Organic content anchored on scanned catalog product “${product.name}”.`) + mediaNote;
      out.push({
        plan_source_key: `organic:catalog:product:${product.slug}`,
        track: 'organic',
        title: pair(`${input.strategyName} — Product: ${product.name}`),
        description: pair(desc),
        channels,
        formats,
        brief: {
          objective: pair(`Spotlight catalog product: ${focus}`),
          audience: pair(audienceText),
          keyMessage: pair(
            product.description?.trim() ||
              `${primaryMessage} — feature ${product.name} with evidence-backed claims only.`,
          ),
        },
      });
    }
    const serviceCap = Math.min(catalogServices.length, DEFAULT_MAX_CATALOG_SERVICE_REQUESTS);
    for (const service of catalogServices.slice(0, serviceCap)) {
      const desc =
        service.description?.trim() ||
        `Organic content explaining scanned service “${service.name}”.`;
      out.push({
        plan_source_key: `organic:catalog:service:${service.slug}`,
        track: 'organic',
        title: pair(`${input.strategyName} — Service: ${service.name}`),
        description: pair(desc),
        channels,
        formats,
        brief: {
          objective: pair(`Explain service offering: ${service.name}`),
          audience: pair(audienceText),
          keyMessage: pair(service.description?.trim() || `${primaryMessage} — ${service.name}`),
        },
      });
    }
  }

  if (input.paidEnabled && input.paid && catalogProducts.length > 0) {
    const formats = (input.paid.formats ?? []).map(readLabel).filter(Boolean);
    const offer = input.paid.offer_angle?.trim() || primaryMessage;
    for (const product of catalogProducts.slice(0, DEFAULT_MAX_CATALOG_PAID_PRODUCT_REQUESTS)) {
      const paidMediaNote = product.primary_media_view_url
        ? ' Feature approved catalog product creative (image or video) from the brand scan.'
        : '';
      out.push({
        plan_source_key: `paid:catalog:product:${product.slug}`,
        track: 'paid',
        title: pair(`${input.strategyName} — Paid: ${product.name}`),
        description: pair(
          (product.description?.trim() || `Paid promotion for catalog product ${product.name}.`) +
            paidMediaNote,
        ),
        channels: [],
        formats,
        brief: {
          objective: pair(`Drive conversions for ${product.name}`),
          audience: pair(audienceText),
          keyMessage: pair(offer),
        },
      });
    }
  }

  if (input.paidEnabled && input.paidPlan && input.paidPlan.allocations.length > 0) {
    const budget = input.paidBudgetAmount;
    for (let i = 0; i < input.paidPlan.allocations.length; i += 1) {
      const row = input.paidPlan.allocations[i]!;
      const channel = row.platform;
      const objective = row.objective;
      const share = row.share_pct;
      const amountNote =
        budget != null && Number.isFinite(budget)
          ? ` · ~${((budget * share) / 100).toFixed(2)} planning budget`
          : '';
      const title = `${input.strategyName} — ${channel} · ${objective}`;
      const desc =
        (row.rationale?.trim() ||
          `Paid planning allocation ${share}% on ${channel} (${objective}).`) + amountNote;
      out.push({
        plan_source_key: `paid:allocation:${i}:${channel}:${objective}`,
        track: 'paid',
        title: pair(title),
        description: pair(desc),
        channels: [channel],
        formats: (input.paid?.formats ?? []).map(readLabel).filter(Boolean),
        brief: {
          objective: pair(`${objective} on ${channel}`),
          audience: pair(audienceText),
          keyMessage: pair(input.paid?.offer_angle?.trim() || primaryMessage),
        },
      });
    }
    for (let i = 0; i < input.paidPlan.experiments.length; i += 1) {
      const experiment = input.paidPlan.experiments[i]!;
      out.push({
        plan_source_key: `paid:experiment:${i}`,
        track: 'paid',
        title: pair(`${input.strategyName} — Test: ${experiment.name}`),
        description: pair(experiment.hypothesis),
        channels: experiment.platform ? [experiment.platform] : [],
        formats: [],
        brief: {
          objective: pair(experiment.hypothesis),
          audience: pair(audienceText),
          keyMessage: pair(experiment.primary_metric),
        },
      });
    }
  } else if (input.paidEnabled && input.paid) {
    const objectives = (input.paid.campaign_objectives ?? []).map(readLabel).filter(Boolean);
    const formats = (input.paid.formats ?? []).map(readLabel).filter(Boolean);
    const offer = input.paid.offer_angle?.trim() || '';
    const items = objectives.length > 0 ? objectives : ['Paid campaign plan'];
    for (let i = 0; i < items.length; i += 1) {
      const objective = items[i]!;
      out.push({
        plan_source_key: `paid:objective:${i}`,
        track: 'paid',
        title: pair(`${input.strategyName} — Paid: ${objective}`),
        description: pair(offer || objective),
        channels: [],
        formats,
        brief: {
          objective: pair(objective),
          audience: pair(audienceText),
          keyMessage: pair(offer || primaryMessage),
        },
      });
    }
  }

  return out;
}
