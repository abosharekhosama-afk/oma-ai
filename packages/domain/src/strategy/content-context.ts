/**
 * DEC-029 4.4: what an approved strategy tells content AI about one post.
 * Built only from APPROVED strategy versions; all fields are human-reviewed data.
 */
export type StrategyContentContext = {
  strategy_version_id: string;
  pillar_key: string | null;
  pillar_name: string | null;
  pillar_description: string | null;
  funnel_stage: string | null;
  objective: string | null;
  audience: string | null;
  key_message: string | null;
  cta: string | null;
  target_keyword: string | null;
};

const clip = (v: string | null | undefined, max: number) => {
  const t = (v ?? '').replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, max) : null;
};

export function normalizeStrategyContentContext(
  ctx: StrategyContentContext,
): StrategyContentContext {
  return {
    strategy_version_id: ctx.strategy_version_id,
    pillar_key: clip(ctx.pillar_key, 48),
    pillar_name: clip(ctx.pillar_name, 120),
    pillar_description: clip(ctx.pillar_description, 400),
    funnel_stage: clip(ctx.funnel_stage, 40),
    objective: clip(ctx.objective, 300),
    audience: clip(ctx.audience, 300),
    key_message: clip(ctx.key_message, 300),
    cta: clip(ctx.cta, 160),
    target_keyword: clip(ctx.target_keyword, 120),
  };
}

/** Compact prompt block; empty when nothing useful is known. */
export function strategyContextText(ctx: StrategyContentContext | null | undefined): string {
  if (!ctx) return '';
  const n = normalizeStrategyContentContext(ctx);
  const lines = [
    n.pillar_name ? `pillar=${n.pillar_name}${n.funnel_stage ? ` (${n.funnel_stage})` : ''}` : '',
    n.pillar_description ? `pillarFocus=${n.pillar_description}` : '',
    n.objective ? `objective=${n.objective}` : '',
    n.audience ? `audience=${n.audience}` : '',
    n.key_message ? `keyMessage=${n.key_message}` : '',
    n.cta ? `cta=${n.cta}` : '',
    n.target_keyword ? `targetKeyword=${n.target_keyword}` : '',
  ].filter(Boolean);
  return lines.join('\n');
}
