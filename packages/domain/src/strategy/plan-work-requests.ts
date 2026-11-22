import {
  DEFAULT_MAX_CATALOG_PAID_PRODUCT_REQUESTS,
  DEFAULT_MAX_CATALOG_PRODUCT_REQUESTS,
  DEFAULT_MAX_CATALOG_SERVICE_REQUESTS,
  DEFAULT_SELECTED_CATALOG_PAID_PRODUCTS,
  DEFAULT_SELECTED_CATALOG_PRODUCTS,
  DEFAULT_SELECTED_CATALOG_SERVICES,
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
  /** v2 pillar key for organic pillar drafts (calendar slot assignment, DEC-029 4.2). */
  pillar_key?: string | null;
  /**
   * False for catalog items beyond the default pick (10 products / 10 services /
   * 10 paid products). A commit without explicit keys creates only selected drafts.
   */
  default_selected?: boolean;
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

/** Template text with a real Arabic rendering (brand language), not a copy of the English. */
function bi(en: string, ar: string): { en: string; ar: string } {
  return { en: en.trim(), ar: ar.trim() };
}

/** User-entered text wins in both languages; otherwise the bilingual template. */
function textOr(value: string, fallback: { en: string; ar: string }): { en: string; ar: string } {
  return value.trim() ? pair(value) : fallback;
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
  const primaryGoal = textOr(
    readLabel(goals[0]),
    bi('Deliver the approved organic/paid plan', 'تنفيذ الخطة العضوية والمدفوعة المعتمدة'),
  );
  const primaryMessage = readLabel(keyMessages[0]) || positioning || input.strategyName;
  const planAudiences = input.paidPlan?.audiences ?? [];
  const audienceName = planAudiences[0]?.name?.trim() || input.audiences[0]?.name?.trim() || '';
  const audienceText = textOr(
    planAudiences[0]?.description?.trim() ||
      input.audiences[0]?.description?.trim() ||
      audienceName,
    bi('Primary audience', 'الجمهور الأساسي'),
  );

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
      const written = pillar.description?.trim() || growth;
      const description = written ? pair(written) : bi(pillar.name_en, pillar.name_ar);
      out.push({
        plan_source_key: pillarSourceKey(pillar.key),
        pillar_key: pillar.key,
        track: 'organic',
        title: {
          en: `${input.strategyName} — ${pillar.name_en}`,
          ar: `${input.strategyName} — ${pillar.name_ar}`,
        },
        description,
        channels: organicChannels,
        formats: organicFormats,
        brief: {
          objective: primaryGoal,
          audience: audienceText,
          keyMessage: { en: pillar.name_en, ar: pillar.name_ar },
        },
      });
    }
  } else if (input.organicEnabled && input.organic) {
    const pillars = (input.organic.pillars ?? []).map(readLabel).filter(Boolean);
    const growth = input.organic.growth_goals?.trim() || '';
    const items = pillars.length > 0 ? pillars : [''];
    for (let i = 0; i < items.length; i += 1) {
      const pillar = items[i]!;
      out.push({
        plan_source_key: `organic:pillar:${i}`,
        track: 'organic',
        title: pillar
          ? pair(`${input.strategyName} — ${pillar}`)
          : bi(
              `${input.strategyName} — Organic content plan`,
              `${input.strategyName} — خطة المحتوى العضوي`,
            ),
        description: textOr(growth || pillar, bi('Organic content plan', 'خطة المحتوى العضوي')),
        channels: organicChannels,
        formats: organicFormats,
        brief: {
          objective: primaryGoal,
          audience: audienceText,
          keyMessage: pair(pillar || primaryMessage),
        },
      });
    }
  }

  const catalog = input.catalogOfferings ?? [];
  // Products with approved media first: they make the strongest default picks.
  const catalogProducts = catalog
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.kind === 'product')
    .sort(
      (a, b) =>
        Number(Boolean(b.item.primary_media_view_url)) -
          Number(Boolean(a.item.primary_media_view_url)) || a.index - b.index,
    )
    .map(({ item }) => item);
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
    for (const [productIndex, product] of catalogProducts.slice(0, productCap).entries()) {
      const focus = product.category ? `${product.name} (${product.category})` : product.name;
      const mediaNote = product.primary_media_view_url
        ? bi(
            ' Use approved catalog product media in WorkDrive as the visual anchor.',
            ' استخدم صور المنتج المعتمدة من الكتالوج في WorkDrive كعنصر بصري أساسي.',
          )
        : bi('', '');
      const baseDesc = textOr(
        product.description?.trim() ?? '',
        bi(
          `Organic content anchored on scanned catalog product “${product.name}”.`,
          `محتوى عضوي يتمحور حول منتج الكتالوج «${product.name}».`,
        ),
      );
      const desc = { en: baseDesc.en + mediaNote.en, ar: baseDesc.ar + mediaNote.ar };
      out.push({
        plan_source_key: `organic:catalog:product:${product.slug}`,
        default_selected: productIndex < DEFAULT_SELECTED_CATALOG_PRODUCTS,
        track: 'organic',
        title: bi(
          `${input.strategyName} — Product: ${product.name}`,
          `${input.strategyName} — منتج: ${product.name}`,
        ),
        description: desc,
        channels,
        formats,
        brief: {
          objective: bi(`Spotlight catalog product: ${focus}`, `إبراز منتج من الكتالوج: ${focus}`),
          audience: audienceText,
          keyMessage: textOr(
            product.description?.trim() ?? '',
            bi(
              `${primaryMessage} — feature ${product.name} with evidence-backed claims only.`,
              `${primaryMessage} — اعرض ${product.name} بادعاءات مدعومة بالأدلة فقط.`,
            ),
          ),
        },
      });
    }
    const serviceCap = Math.min(catalogServices.length, DEFAULT_MAX_CATALOG_SERVICE_REQUESTS);
    for (const [serviceIndex, service] of catalogServices.slice(0, serviceCap).entries()) {
      const desc = textOr(
        service.description?.trim() ?? '',
        bi(
          `Organic content explaining scanned service “${service.name}”.`,
          `محتوى عضوي يشرح الخدمة «${service.name}».`,
        ),
      );
      out.push({
        plan_source_key: `organic:catalog:service:${service.slug}`,
        default_selected: serviceIndex < DEFAULT_SELECTED_CATALOG_SERVICES,
        track: 'organic',
        title: bi(
          `${input.strategyName} — Service: ${service.name}`,
          `${input.strategyName} — خدمة: ${service.name}`,
        ),
        description: desc,
        channels,
        formats,
        brief: {
          objective: bi(`Explain service offering: ${service.name}`, `شرح الخدمة: ${service.name}`),
          audience: audienceText,
          keyMessage: pair(service.description?.trim() || `${primaryMessage} — ${service.name}`),
        },
      });
    }
  }

  if (input.paidEnabled && input.paid && catalogProducts.length > 0) {
    const formats = (input.paid.formats ?? []).map(readLabel).filter(Boolean);
    const offer = input.paid.offer_angle?.trim() || primaryMessage;
    for (const [paidIndex, product] of catalogProducts
      .slice(0, DEFAULT_MAX_CATALOG_PAID_PRODUCT_REQUESTS)
      .entries()) {
      const paidMediaNote = product.primary_media_view_url
        ? bi(
            ' Feature approved catalog product creative (image or video) from the brand scan.',
            ' استخدم تصميم المنتج المعتمد (صورة أو فيديو) من فحص العلامة.',
          )
        : bi('', '');
      const paidBase = textOr(
        product.description?.trim() ?? '',
        bi(
          `Paid promotion for catalog product ${product.name}.`,
          `ترويج مدفوع لمنتج الكتالوج ${product.name}.`,
        ),
      );
      out.push({
        plan_source_key: `paid:catalog:product:${product.slug}`,
        default_selected: paidIndex < DEFAULT_SELECTED_CATALOG_PAID_PRODUCTS,
        track: 'paid',
        title: bi(
          `${input.strategyName} — Paid: ${product.name}`,
          `${input.strategyName} — مدفوع: ${product.name}`,
        ),
        description: { en: paidBase.en + paidMediaNote.en, ar: paidBase.ar + paidMediaNote.ar },
        channels: [],
        formats,
        brief: {
          objective: bi(
            `Drive conversions for ${product.name}`,
            `زيادة التحويلات لـ ${product.name}`,
          ),
          audience: audienceText,
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
      const amount =
        budget != null && Number.isFinite(budget) ? ((budget * share) / 100).toFixed(2) : null;
      const title = `${input.strategyName} — ${channel} · ${objective}`;
      const base = textOr(
        row.rationale?.trim() ?? '',
        bi(
          `Paid planning allocation ${share}% on ${channel} (${objective}).`,
          `تخصيص مدفوع ${share}% على ${channel} (${objective}).`,
        ),
      );
      const desc = {
        en: base.en + (amount ? ` · ~${amount} planning budget` : ''),
        ar: base.ar + (amount ? ` · ~${amount} من ميزانية التخطيط` : ''),
      };
      out.push({
        plan_source_key: `paid:allocation:${i}:${channel}:${objective}`,
        track: 'paid',
        title: pair(title),
        description: desc,
        channels: [channel],
        formats: (input.paid?.formats ?? []).map(readLabel).filter(Boolean),
        brief: {
          objective: bi(`${objective} on ${channel}`, `${objective} على ${channel}`),
          audience: audienceText,
          keyMessage: pair(input.paid?.offer_angle?.trim() || primaryMessage),
        },
      });
    }
    for (let i = 0; i < input.paidPlan.experiments.length; i += 1) {
      const experiment = input.paidPlan.experiments[i]!;
      out.push({
        plan_source_key: `paid:experiment:${i}`,
        track: 'paid',
        title: bi(
          `${input.strategyName} — Test: ${experiment.name}`,
          `${input.strategyName} — تجربة: ${experiment.name}`,
        ),
        description: pair(experiment.hypothesis),
        channels: experiment.platform ? [experiment.platform] : [],
        formats: [],
        brief: {
          objective: pair(experiment.hypothesis),
          audience: audienceText,
          keyMessage: pair(experiment.primary_metric),
        },
      });
    }
  } else if (input.paidEnabled && input.paid) {
    const objectives = (input.paid.campaign_objectives ?? []).map(readLabel).filter(Boolean);
    const formats = (input.paid.formats ?? []).map(readLabel).filter(Boolean);
    const offer = input.paid.offer_angle?.trim() || '';
    const items = objectives.length > 0 ? objectives : [''];
    for (let i = 0; i < items.length; i += 1) {
      const objective = items[i]!;
      const label = textOr(objective, bi('Paid campaign plan', 'خطة الحملة المدفوعة'));
      out.push({
        plan_source_key: `paid:objective:${i}`,
        track: 'paid',
        title: bi(
          `${input.strategyName} — Paid: ${label.en}`,
          `${input.strategyName} — مدفوع: ${label.ar}`,
        ),
        description: offer ? pair(offer) : label,
        channels: [],
        formats,
        brief: {
          objective: label,
          audience: audienceText,
          keyMessage: pair(offer || primaryMessage),
        },
      });
    }
  }

  return out;
}
