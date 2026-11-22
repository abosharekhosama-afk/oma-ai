import { getPrisma, tenantWhere } from '@oma/db';
import { normalizeStrategyContentContext, type StrategyContentContext } from '@oma/domain';
import { readStrategyPlan } from '../strategy/strategy-plan.service';

function firstText(raw: unknown): string | null {
  if (typeof raw === 'string') return raw.trim() || null;
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const t = firstText(item);
      if (t) return t;
    }
    return null;
  }
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    return firstText(r.value ?? r.name ?? r.label ?? null);
  }
  return null;
}

/**
 * DEC-029 4.4: strategy context for a content item, only from an APPROVED version
 * of the same tenant + brand. Returns null when the post is not strategy work.
 */
export async function loadStrategyContentContext(
  tenantId: string,
  brandId: string,
  contentId: string | undefined,
  language: 'en' | 'ar',
): Promise<StrategyContentContext | null> {
  if (!contentId) return null;
  const content = await getPrisma().contentItem.findFirst({
    where: tenantWhere(tenantId, { id: contentId, brandId }),
    select: { id: true, strategyVersionId: true, pillarKey: true, targetKeyword: true },
  });
  if (!content?.strategyVersionId) return null;
  const version = await getPrisma().strategyVersion.findFirst({
    where: tenantWhere(tenantId, { id: content.strategyVersionId, brandId, status: 'APPROVED' }),
    select: { id: true, foundationJson: true, organicTrack: { select: { messageCta: true } } },
  });
  if (!version) return null;
  const plan = await readStrategyPlan(getPrisma(), version.id);
  const pillar = content.pillarKey
    ? (plan.organic.pillars.find((p) => p.key === content.pillarKey) ?? null)
    : null;
  const request = await getPrisma().workRequest.findFirst({
    where: { tenantId, brandId, strategyVersionId: version.id, contentId: content.id },
    select: {
      briefObjectiveEn: true,
      briefObjectiveAr: true,
      briefAudienceEn: true,
      briefAudienceAr: true,
      briefKeyMessageEn: true,
      briefKeyMessageAr: true,
    },
  });
  let foundation: Record<string, unknown> = {};
  try {
    foundation = JSON.parse(version.foundationJson || '{}') as Record<string, unknown>;
  } catch {
    foundation = {};
  }
  const ar = language === 'ar';
  const pick = (en?: string | null, arText?: string | null) =>
    (ar ? arText || en : en || arText) || null;
  return normalizeStrategyContentContext({
    strategy_version_id: version.id,
    pillar_key: pillar?.key ?? content.pillarKey ?? null,
    pillar_name: pillar ? (ar ? pillar.name_ar : pillar.name_en) : null,
    pillar_description: pillar?.description ?? null,
    funnel_stage: pillar?.funnel_stage ?? null,
    objective:
      pick(request?.briefObjectiveEn, request?.briefObjectiveAr) ?? firstText(foundation.goals),
    audience:
      pick(request?.briefAudienceEn, request?.briefAudienceAr) ??
      plan.paid.audiences[0]?.name ??
      null,
    key_message:
      pick(request?.briefKeyMessageEn, request?.briefKeyMessageAr) ??
      firstText(foundation.keyMessages) ??
      firstText(foundation.positioning),
    cta: version.organicTrack?.messageCta ?? null,
    target_keyword: content.targetKeyword ?? null,
  });
}
