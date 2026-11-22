'use client';

import { Button, Input, OmaSelect, Tag } from '@oma/ui/controls';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getApiError } from '../../lib/brand-api';
import {
  EXPERIMENT_VARIABLES,
  GAP_KINDS,
  PAID_OBJECTIVES,
  PAID_PLATFORMS,
  SEARCH_INTENTS,
  acceptStrategyPlanProposal,
  allocationTotal,
  getStrategyPlan,
  organicPlanWarnings,
  paidPlanWarnings,
  pillarShareTotal,
  planSourceLabelKey,
  proposeStrategyPlan,
  putOrganicPlan,
  putPaidPlan,
  slugifyKey,
  type OrganicPlan,
  type PaidPlan,
  type PlanProposal,
  type PlanSource,
  type StrategyPlan,
} from '../../lib/strategy-plan-api';
import { useT } from '../../lib/use-locale';
import { SeoStrategyImport } from './seo-strategy-import';

type Track = 'organic' | 'paid';

function SourceTag({ source, t }: { source?: PlanSource | null; t: (k: string) => string }) {
  const color = source === 'AI_ESTIMATE' ? 'gold' : source === 'DETERMINISTIC' ? 'blue' : undefined;
  return (
    <Tag color={color} data-testid="plan-source">
      {t(planSourceLabelKey(source))}
    </Tag>
  );
}

const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v));
const options = (values: string[]) => values.map((v) => ({ value: v, label: v }));

/**
 * Planable-style editor for the tracks-v2 plan (DEC-021). One instance per track.
 * AI output is a proposal: it is previewed here and only written after "Apply".
 */
export function StrategyPlanEditor({
  brandId,
  strategyId,
  versionId,
  track,
}: {
  brandId: string;
  strategyId: string;
  versionId: string;
  track: Track;
}) {
  const t = useT();
  const [plan, setPlan] = useState<StrategyPlan | null>(null);
  const [organic, setOrganic] = useState<OrganicPlan>({
    cadence: [],
    pillars: [],
    seo_keywords: [],
    content_gaps: [],
  });
  const [paid, setPaid] = useState<PaidPlan>({ allocations: [], audiences: [], experiments: [] });
  const [paidBudget, setPaidBudget] = useState('');
  const [paidCurrency, setPaidCurrency] = useState('USD');
  const [proposal, setProposal] = useState<PlanProposal | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: 'saved' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await getStrategyPlan(brandId, strategyId, versionId);
      setPlan(res.data);
      setOrganic(res.data.organic);
      setPaid(res.data.paid);
      setPaidBudget(res.data.paid.budget_amount ?? '');
      setPaidCurrency(res.data.paid.budget_currency ?? 'USD');
    } catch (err) {
      setStatus({ kind: 'error', text: getApiError(err).message });
    }
  }, [brandId, strategyId, versionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const enabled = plan ? (track === 'organic' ? plan.organic_enabled : plan.paid_enabled) : false;
  const editable = Boolean(plan?.editable && enabled);
  const warnings = useMemo(
    () => (track === 'organic' ? organicPlanWarnings(organic) : paidPlanWarnings(paid)),
    [track, organic, paid],
  );

  function apply(res: { data: StrategyPlan }, message: string) {
    setPlan(res.data);
    setOrganic(res.data.organic);
    setPaid(res.data.paid);
    setPaidBudget(res.data.paid.budget_amount ?? '');
    setPaidCurrency(res.data.paid.budget_currency ?? 'USD');
    setStatus({ kind: 'saved', text: message });
  }

  async function save() {
    if (!plan) return;
    setBusy(true);
    try {
      const res =
        track === 'organic'
          ? await putOrganicPlan(brandId, strategyId, versionId, plan.row_version, organic)
          : await putPaidPlan(brandId, strategyId, versionId, plan.row_version, paid, {
              amount: paidBudget,
              currency: paidCurrency,
            });
      apply(res, t('strategy.saved'));
    } catch (err) {
      setStatus({ kind: 'error', text: getApiError(err).message });
    } finally {
      setBusy(false);
    }
  }

  async function propose(mode: 'ai' | 'template') {
    setBusy(true);
    setStatus(null);
    try {
      const res = await proposeStrategyPlan(brandId, strategyId, versionId, {
        mode,
        tracks: [track],
      });
      setProposal(res.data);
    } catch (err) {
      setStatus({ kind: 'error', text: getApiError(err).message });
    } finally {
      setBusy(false);
    }
  }

  async function acceptProposal() {
    if (!plan || !proposal) return;
    if (proposal.mode === 'template' || !proposal.run_id) {
      // Templates are a starting point: load into the editor, the human saves.
      if (track === 'organic' && proposal.proposal.organic) setOrganic(proposal.proposal.organic);
      if (track === 'paid' && proposal.proposal.paid) setPaid(proposal.proposal.paid);
      setProposal(null);
      setStatus({ kind: 'saved', text: t('strategy.plan.templateLoaded') });
      return;
    }
    setBusy(true);
    try {
      const res = await acceptStrategyPlanProposal(brandId, strategyId, versionId, {
        run_id: proposal.run_id,
        row_version: plan.row_version,
        tracks: [track],
      });
      setProposal(null);
      apply(res, t('strategy.plan.proposalApplied'));
    } catch (err) {
      setStatus({ kind: 'error', text: getApiError(err).message });
    } finally {
      setBusy(false);
    }
  }

  if (!plan) return null;

  const proposedOrganic = proposal?.proposal.organic;
  const proposedPaid = proposal?.proposal.paid;

  return (
    <section
      className="oma-panel oma-plan-editor"
      data-testid={`strategy-plan-${track}`}
      aria-label={t(`strategy.plan.${track}.title`)}
    >
      <header className="oma-plan-toolbar">
        <h2 style={{ margin: 0 }}>{t(`strategy.plan.${track}.title`)}</h2>
        {track === 'organic' ? (
          <Tag>
            {t(
              plan.research.mode === 'ai_estimate'
                ? 'strategy.plan.research.aiEstimate'
                : 'strategy.plan.research.manual',
            )}
          </Tag>
        ) : null}
        {editable ? (
          <>
            <Button
              onClick={() => void propose('ai')}
              disabled={busy}
              data-testid="plan-propose-ai"
            >
              {t('strategy.plan.generateAi')}
            </Button>
            <Button onClick={() => void propose('template')} disabled={busy}>
              {t('strategy.plan.useTemplate')}
            </Button>
          </>
        ) : null}
      </header>

      {!enabled ? <p>{t('strategy.plan.trackDisabled')}</p> : null}
      {enabled && !plan.editable ? <p>{t('strategy.warning.immutable')}</p> : null}

      {track === 'organic' && enabled ? (
        <SeoStrategyImport
          brandId={brandId}
          strategyId={strategyId}
          versionId={versionId}
          editable={editable}
          plan={plan}
          onMerged={(next) => apply({ data: next }, t('strategy.plan.seoImport.applied'))}
        />
      ) : null}

      {proposal ? (
        <div className="oma-plan-proposal" role="region" data-testid="plan-proposal">
          <strong>
            {t(
              proposal.mode === 'ai'
                ? 'strategy.plan.proposalAi'
                : 'strategy.plan.proposalTemplate',
            )}
          </strong>
          <p>{proposal.rationale}</p>
          <p className="oma-badge oma-badge-warning">{t('strategy.plan.proposalNotice')}</p>
          {proposedOrganic ? (
            <ul>
              <li>
                {t('strategy.plan.pillars')}:{' '}
                {proposedOrganic.pillars.map((p) => p.name_en).join(' · ')}
              </li>
              <li>
                {t('strategy.plan.keywords')}:{' '}
                {proposedOrganic.seo_keywords.map((k) => k.keyword).join(' · ')}
              </li>
              <li>
                {t('strategy.plan.gaps')}:{' '}
                {proposedOrganic.content_gaps.map((g) => g.topic).join(' · ')}
              </li>
            </ul>
          ) : null}
          {proposedPaid ? (
            <ul>
              <li>
                {t('strategy.plan.allocations')}:{' '}
                {proposedPaid.allocations
                  .map((a) => `${a.platform}/${a.objective} ${a.share_pct}%`)
                  .join(' · ')}
              </li>
              <li>
                {t('strategy.plan.audiences')}:{' '}
                {proposedPaid.audiences.map((a) => a.name).join(' · ')}
              </li>
              <li>
                {t('strategy.plan.experiments')}:{' '}
                {proposedPaid.experiments.map((e) => e.name).join(' · ')}
              </li>
            </ul>
          ) : null}
          <div className="oma-plan-toolbar">
            <Button
              type="primary"
              onClick={() => void acceptProposal()}
              disabled={busy}
              data-testid="plan-proposal-apply"
            >
              {t(
                proposal.mode === 'ai'
                  ? 'strategy.plan.applyProposal'
                  : 'strategy.plan.loadTemplate',
              )}
            </Button>
            <Button onClick={() => setProposal(null)} disabled={busy}>
              {t('strategy.plan.discardProposal')}
            </Button>
          </div>
        </div>
      ) : null}

      {track === 'organic' ? (
        <OrganicTables plan={organic} onChange={setOrganic} editable={editable} t={t} />
      ) : (
        <>
          <section className="oma-form-section oma-plan-budget-row" data-testid="plan-paid-budget">
            <div className="oma-form-grid">
              <label>
                {t('strategy.paid.budget')}
                <Input
                  value={paidBudget}
                  onChange={(e) => setPaidBudget(e.target.value)}
                  disabled={!editable}
                  data-testid="plan-paid-budget-amount"
                />
              </label>
              <label>
                {t('strategy.plan.budgetCurrency')}
                <Input
                  value={paidCurrency}
                  onChange={(e) => setPaidCurrency(e.target.value)}
                  disabled={!editable}
                  data-testid="plan-paid-budget-currency"
                />
              </label>
            </div>
          </section>
          <PaidTables
            plan={paid}
            onChange={setPaid}
            editable={editable}
            t={t}
            budget={paidBudget.trim() || null}
            currency={paidCurrency}
          />
        </>
      )}

      {warnings.length ? (
        <ul role="alert" className="oma-plan-total" data-state="bad">
          {warnings.map((w) => (
            <li key={w}>{t(w)}</li>
          ))}
        </ul>
      ) : null}
      {status ? (
        <p
          className="oma-save-status"
          data-state={status.kind}
          role={status.kind === 'error' ? 'alert' : 'status'}
        >
          {status.text}
        </p>
      ) : null}
      {editable ? (
        <div>
          <Button
            type="primary"
            onClick={() => void save()}
            disabled={busy || warnings.length > 0}
            data-testid={`plan-save-${track}`}
          >
            {t('strategy.plan.save')}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function OrganicTables({
  plan,
  onChange,
  editable,
  t,
}: {
  plan: OrganicPlan;
  onChange: (next: OrganicPlan) => void;
  editable: boolean;
  t: (k: string) => string;
}) {
  const pillarOptions = [
    { value: '', label: '—' },
    ...plan.pillars.map((p) => ({ value: p.key, label: p.name_en || p.key })),
  ];
  const set = <K extends keyof OrganicPlan>(key: K, rows: OrganicPlan[K]) =>
    onChange({ ...plan, [key]: rows });
  const share = pillarShareTotal(plan.pillars);
  const cadence = plan.cadence ?? [];
  const perWeek = cadence.reduce((sum, c) => sum + (c.posts_per_week || 0), 0);
  return (
    <>
      <h3>
        {t('strategy.plan.cadence.title')}{' '}
        <span className="oma-plan-total" data-testid="plan-cadence-total">
          ({perWeek}/{t('strategy.plan.cadence.week')})
        </span>
      </h3>
      <p className="oma-muted">{t('strategy.plan.cadence.hint')}</p>
      <div className="oma-plan-table-wrap">
        <table className="oma-plan-table" data-testid="plan-cadence">
          <thead>
            <tr>
              <th>{t('strategy.plan.cadence.channel')}</th>
              <th>{t('strategy.plan.cadence.postsPerWeek')}</th>
              <th>{t('strategy.plan.cadence.formats')}</th>
              <th>{t('strategy.plan.col.source')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {cadence.map((c, i) => (
              <tr key={`cadence-${i}`}>
                <td>
                  <Input
                    value={c.channel}
                    disabled={!editable}
                    data-testid={`plan-cadence-channel-${i}`}
                    onChange={(e) => {
                      const rows = [...cadence];
                      rows[i] = { ...c, channel: e.target.value };
                      set('cadence', rows);
                    }}
                  />
                </td>
                <td>
                  <Input
                    type="number"
                    min={0}
                    max={28}
                    value={c.posts_per_week}
                    disabled={!editable}
                    data-testid={`plan-cadence-ppw-${i}`}
                    onChange={(e) => {
                      const rows = [...cadence];
                      rows[i] = {
                        ...c,
                        posts_per_week: Math.max(0, Math.min(28, numOrNull(e.target.value) ?? 0)),
                      };
                      set('cadence', rows);
                    }}
                  />
                </td>
                <td>
                  <Input
                    value={c.formats.join(', ')}
                    disabled={!editable}
                    placeholder={t('strategy.plan.cadence.formatsPlaceholder')}
                    onChange={(e) => {
                      const rows = [...cadence];
                      rows[i] = {
                        ...c,
                        formats: e.target.value
                          .split(',')
                          .map((f) => f.trim())
                          .filter(Boolean)
                          .slice(0, 8),
                      };
                      set('cadence', rows);
                    }}
                  />
                </td>
                <td>
                  <SourceTag source={c.source} t={t} />
                </td>
                <td>
                  {editable ? (
                    <Button
                      type="text"
                      onClick={() =>
                        set(
                          'cadence',
                          cadence.filter((_, j) => j !== i),
                        )
                      }
                    >
                      {t('strategy.plan.remove')}
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editable ? (
        <Button
          data-testid="plan-cadence-add"
          onClick={() =>
            set('cadence', [
              ...cadence,
              { channel: '', posts_per_week: 3, formats: [], source: 'MANUAL' },
            ])
          }
        >
          {t('strategy.plan.cadence.add')}
        </Button>
      ) : null}

      <h3>
        {t('strategy.plan.pillars')}{' '}
        <span className="oma-plan-total" data-state={share > 100 ? 'bad' : 'ok'}>
          ({share}%)
        </span>
      </h3>
      <div className="oma-plan-table-wrap">
        <table className="oma-plan-table" data-testid="plan-pillars">
          <thead>
            <tr>
              <th>{t('strategy.plan.col.nameEn')}</th>
              <th>{t('strategy.plan.col.nameAr')}</th>
              <th>{t('strategy.plan.col.share')}</th>
              <th>{t('strategy.plan.col.source')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {plan.pillars.map((p, i) => (
              <tr key={`${p.key}-${i}`}>
                <td>
                  <Input
                    value={p.name_en}
                    disabled={!editable}
                    onChange={(e) => {
                      const rows = [...plan.pillars];
                      rows[i] = {
                        ...p,
                        name_en: e.target.value,
                        key: p.key || slugifyKey(e.target.value, `pillar-${i + 1}`),
                      };
                      set('pillars', rows);
                    }}
                  />
                </td>
                <td>
                  <Input
                    dir="rtl"
                    value={p.name_ar}
                    disabled={!editable}
                    onChange={(e) => {
                      const rows = [...plan.pillars];
                      rows[i] = { ...p, name_ar: e.target.value };
                      set('pillars', rows);
                    }}
                  />
                </td>
                <td>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={p.share_target_pct ?? ''}
                    disabled={!editable}
                    onChange={(e) => {
                      const rows = [...plan.pillars];
                      rows[i] = { ...p, share_target_pct: numOrNull(e.target.value) };
                      set('pillars', rows);
                    }}
                  />
                </td>
                <td>
                  <SourceTag source={p.source} t={t} />
                </td>
                <td>
                  {editable ? (
                    <Button
                      type="text"
                      onClick={() =>
                        set(
                          'pillars',
                          plan.pillars.filter((_, j) => j !== i),
                        )
                      }
                    >
                      {t('strategy.plan.remove')}
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editable ? (
        <Button
          onClick={() =>
            set('pillars', [
              ...plan.pillars,
              {
                key: `pillar-${plan.pillars.length + 1}`,
                name_en: '',
                name_ar: '',
                source: 'MANUAL',
              },
            ])
          }
        >
          {t('strategy.plan.addPillar')}
        </Button>
      ) : null}

      <h3>{t('strategy.plan.keywords')}</h3>
      <div className="oma-plan-table-wrap">
        <table className="oma-plan-table" data-testid="plan-keywords">
          <thead>
            <tr>
              <th>{t('strategy.plan.col.keyword')}</th>
              <th>{t('strategy.plan.col.locale')}</th>
              <th>{t('strategy.plan.col.intent')}</th>
              <th>{t('strategy.plan.col.pillar')}</th>
              <th>{t('strategy.plan.col.volume')}</th>
              <th>{t('strategy.plan.col.source')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {plan.seo_keywords.map((k, i) => (
              <tr key={`${k.keyword}-${i}`}>
                <td>
                  <Input
                    value={k.keyword}
                    disabled={!editable}
                    onChange={(e) => {
                      const rows = [...plan.seo_keywords];
                      rows[i] = { ...k, keyword: e.target.value };
                      set('seo_keywords', rows);
                    }}
                  />
                </td>
                <td>
                  <OmaSelect
                    value={k.locale}
                    disabled={!editable}
                    options={options(['ar', 'en'])}
                    onChange={(v) => {
                      const rows = [...plan.seo_keywords];
                      rows[i] = { ...k, locale: v };
                      set('seo_keywords', rows);
                    }}
                  />
                </td>
                <td>
                  <OmaSelect
                    value={k.intent}
                    disabled={!editable}
                    options={SEARCH_INTENTS.map((v) => ({
                      value: v,
                      label: t(`strategy.plan.intent.${v}`),
                    }))}
                    onChange={(v) => {
                      const rows = [...plan.seo_keywords];
                      rows[i] = { ...k, intent: v };
                      set('seo_keywords', rows);
                    }}
                  />
                </td>
                <td>
                  <OmaSelect
                    value={k.pillar_key ?? ''}
                    disabled={!editable}
                    options={pillarOptions}
                    onChange={(v) => {
                      const rows = [...plan.seo_keywords];
                      rows[i] = { ...k, pillar_key: v || null };
                      set('seo_keywords', rows);
                    }}
                  />
                </td>
                <td>
                  <Input
                    type="number"
                    min={0}
                    value={k.monthly_volume ?? ''}
                    disabled={!editable}
                    onChange={(e) => {
                      const rows = [...plan.seo_keywords];
                      const volume = numOrNull(e.target.value);
                      rows[i] = {
                        ...k,
                        monthly_volume: volume,
                        metric_source:
                          volume == null && k.difficulty == null
                            ? null
                            : (k.metric_source ?? 'MANUAL'),
                      };
                      set('seo_keywords', rows);
                    }}
                  />
                </td>
                <td>
                  <SourceTag source={k.metric_source ?? k.source} t={t} />
                  {k.gsc_impressions != null ? (
                    <div className="oma-muted" data-testid="seo-keyword-gsc">
                      {t('strategy.plan.gscImpressions')}: {k.gsc_impressions}
                      {k.gsc_position != null ? ` · #${k.gsc_position.toFixed(1)}` : ''}
                    </div>
                  ) : null}
                </td>
                <td>
                  {editable ? (
                    <Button
                      type="text"
                      onClick={() =>
                        set(
                          'seo_keywords',
                          plan.seo_keywords.filter((_, j) => j !== i),
                        )
                      }
                    >
                      {t('strategy.plan.remove')}
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editable ? (
        <Button
          onClick={() =>
            set('seo_keywords', [
              ...plan.seo_keywords,
              { keyword: '', locale: 'ar', intent: 'INFORMATIONAL', source: 'MANUAL' },
            ])
          }
        >
          {t('strategy.plan.addKeyword')}
        </Button>
      ) : null}

      <h3>{t('strategy.plan.gaps')}</h3>
      <div className="oma-plan-table-wrap">
        <table className="oma-plan-table" data-testid="plan-gaps">
          <thead>
            <tr>
              <th>{t('strategy.plan.col.kind')}</th>
              <th>{t('strategy.plan.col.topic')}</th>
              <th>{t('strategy.plan.col.pillar')}</th>
              <th>{t('strategy.plan.col.source')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {plan.content_gaps.map((g, i) => (
              <tr key={`${g.topic}-${i}`}>
                <td>
                  <OmaSelect
                    value={g.kind}
                    disabled={!editable}
                    options={GAP_KINDS.map((v) => ({
                      value: v,
                      label: t(`strategy.plan.gapKind.${v}`),
                    }))}
                    onChange={(v) => {
                      const rows = [...plan.content_gaps];
                      rows[i] = { ...g, kind: v };
                      set('content_gaps', rows);
                    }}
                  />
                </td>
                <td>
                  <Input
                    value={g.topic}
                    disabled={!editable}
                    onChange={(e) => {
                      const rows = [...plan.content_gaps];
                      rows[i] = { ...g, topic: e.target.value };
                      set('content_gaps', rows);
                    }}
                  />
                </td>
                <td>
                  <OmaSelect
                    value={g.pillar_key ?? ''}
                    disabled={!editable}
                    options={pillarOptions}
                    onChange={(v) => {
                      const rows = [...plan.content_gaps];
                      rows[i] = { ...g, pillar_key: v || null };
                      set('content_gaps', rows);
                    }}
                  />
                </td>
                <td>
                  <SourceTag source={g.source} t={t} />
                </td>
                <td>
                  {editable ? (
                    <Button
                      type="text"
                      onClick={() =>
                        set(
                          'content_gaps',
                          plan.content_gaps.filter((_, j) => j !== i),
                        )
                      }
                    >
                      {t('strategy.plan.remove')}
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editable ? (
        <Button
          onClick={() =>
            set('content_gaps', [
              ...plan.content_gaps,
              { kind: 'MISSING_TOPIC', topic: '', source: 'MANUAL' },
            ])
          }
        >
          {t('strategy.plan.addGap')}
        </Button>
      ) : null}
    </>
  );
}

function PaidTables({
  plan,
  onChange,
  editable,
  t,
  budget,
  currency,
}: {
  plan: PaidPlan;
  onChange: (next: PaidPlan) => void;
  editable: boolean;
  t: (k: string) => string;
  budget: string | null;
  currency: string | null;
}) {
  const set = <K extends keyof PaidPlan>(key: K, rows: PaidPlan[K]) =>
    onChange({ ...plan, [key]: rows });
  const total = allocationTotal(plan.allocations);
  const audienceOptions = [
    { value: '', label: '—' },
    ...plan.audiences.map((a) => ({ value: a.key, label: a.name || a.key })),
  ];
  return (
    <>
      <h3>
        {t('strategy.plan.allocations')}{' '}
        <span
          className="oma-plan-total"
          data-state={plan.allocations.length && total !== 100 ? 'bad' : 'ok'}
          data-testid="plan-allocation-total"
        >
          ({total}%{budget ? ` · ${budget} ${currency ?? ''}` : ''})
        </span>
      </h3>
      <div className="oma-plan-table-wrap">
        <table className="oma-plan-table" data-testid="plan-allocations">
          <thead>
            <tr>
              <th>{t('strategy.plan.col.platform')}</th>
              <th>{t('strategy.plan.col.objective')}</th>
              <th>{t('strategy.plan.col.share')}</th>
              <th>{t('strategy.plan.col.amount')}</th>
              <th>{t('strategy.plan.col.source')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {plan.allocations.map((a, i) => (
              <tr key={`${a.platform}-${a.objective}-${i}`}>
                <td>
                  <OmaSelect
                    value={a.platform}
                    disabled={!editable}
                    options={options(PAID_PLATFORMS)}
                    onChange={(v) => {
                      const rows = [...plan.allocations];
                      rows[i] = { ...a, platform: v, amount: null };
                      set('allocations', rows);
                    }}
                  />
                </td>
                <td>
                  <OmaSelect
                    value={a.objective}
                    disabled={!editable}
                    options={PAID_OBJECTIVES.map((v) => ({
                      value: v,
                      label: t(`strategy.plan.objective.${v}`),
                    }))}
                    onChange={(v) => {
                      const rows = [...plan.allocations];
                      rows[i] = { ...a, objective: v, amount: null };
                      set('allocations', rows);
                    }}
                  />
                </td>
                <td>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={a.share_pct}
                    disabled={!editable}
                    onChange={(e) => {
                      const rows = [...plan.allocations];
                      rows[i] = { ...a, share_pct: Number(e.target.value || 0), amount: null };
                      set('allocations', rows);
                    }}
                  />
                </td>
                <td>{a.amount ?? '—'}</td>
                <td>
                  <SourceTag source={a.source} t={t} />
                </td>
                <td>
                  {editable ? (
                    <Button
                      type="text"
                      onClick={() =>
                        set(
                          'allocations',
                          plan.allocations.filter((_, j) => j !== i),
                        )
                      }
                    >
                      {t('strategy.plan.remove')}
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editable ? (
        <Button
          onClick={() =>
            set('allocations', [
              ...plan.allocations,
              { platform: 'INSTAGRAM', objective: 'AWARENESS', share_pct: 0, source: 'MANUAL' },
            ])
          }
        >
          {t('strategy.plan.addAllocation')}
        </Button>
      ) : null}

      <h3>{t('strategy.plan.audiences')}</h3>
      <div className="oma-plan-table-wrap">
        <table className="oma-plan-table" data-testid="plan-audiences">
          <thead>
            <tr>
              <th>{t('strategy.plan.col.name')}</th>
              <th>{t('strategy.plan.col.ageMin')}</th>
              <th>{t('strategy.plan.col.ageMax')}</th>
              <th>{t('strategy.plan.col.locations')}</th>
              <th>{t('strategy.plan.col.interests')}</th>
              <th>{t('strategy.plan.col.source')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {plan.audiences.map((a, i) => {
              const update = (patch: Partial<typeof a>) => {
                const rows = [...plan.audiences];
                rows[i] = { ...a, ...patch };
                set('audiences', rows);
              };
              const csv = (v: string) =>
                v
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean);
              return (
                <tr key={`${a.key}-${i}`}>
                  <td>
                    <Input
                      value={a.name}
                      disabled={!editable}
                      onChange={(e) => update({ name: e.target.value })}
                    />
                  </td>
                  <td>
                    <Input
                      type="number"
                      min={13}
                      max={65}
                      value={a.targeting.age_min ?? ''}
                      disabled={!editable}
                      onChange={(e) =>
                        update({
                          targeting: { ...a.targeting, age_min: numOrNull(e.target.value) },
                        })
                      }
                    />
                  </td>
                  <td>
                    <Input
                      type="number"
                      min={13}
                      max={65}
                      value={a.targeting.age_max ?? ''}
                      disabled={!editable}
                      onChange={(e) =>
                        update({
                          targeting: { ...a.targeting, age_max: numOrNull(e.target.value) },
                        })
                      }
                    />
                  </td>
                  <td>
                    <Input
                      value={a.targeting.locations.join(', ')}
                      disabled={!editable}
                      onChange={(e) =>
                        update({ targeting: { ...a.targeting, locations: csv(e.target.value) } })
                      }
                    />
                  </td>
                  <td>
                    <Input
                      value={a.targeting.interests.join(', ')}
                      disabled={!editable}
                      onChange={(e) =>
                        update({ targeting: { ...a.targeting, interests: csv(e.target.value) } })
                      }
                    />
                  </td>
                  <td>
                    <SourceTag source={a.source} t={t} />
                  </td>
                  <td>
                    {editable ? (
                      <Button
                        type="text"
                        onClick={() =>
                          set(
                            'audiences',
                            plan.audiences.filter((_, j) => j !== i),
                          )
                        }
                      >
                        {t('strategy.plan.remove')}
                      </Button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {editable ? (
        <Button
          onClick={() =>
            set('audiences', [
              ...plan.audiences,
              {
                key: `audience-${plan.audiences.length + 1}`,
                name: '',
                source: 'MANUAL',
                targeting: { locations: [], languages: [], interests: [] },
              },
            ])
          }
        >
          {t('strategy.plan.addAudience')}
        </Button>
      ) : null}

      <h3>{t('strategy.plan.experiments')}</h3>
      <div className="oma-plan-table-wrap">
        <table className="oma-plan-table" data-testid="plan-experiments">
          <thead>
            <tr>
              <th>{t('strategy.plan.col.name')}</th>
              <th>{t('strategy.plan.col.hypothesis')}</th>
              <th>{t('strategy.plan.col.variable')}</th>
              <th>{t('strategy.plan.col.audience')}</th>
              <th>A</th>
              <th>B</th>
              <th>{t('strategy.plan.col.metric')}</th>
              <th>{t('strategy.plan.col.source')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {plan.experiments.map((x, i) => {
              const update = (patch: Partial<typeof x>) => {
                const rows = [...plan.experiments];
                rows[i] = { ...x, ...patch };
                set('experiments', rows);
              };
              const variant = (key: 'A' | 'B') =>
                x.variants.find((v) => v.key === key)?.description ?? '';
              const setVariant = (key: 'A' | 'B', description: string) => {
                const others = x.variants.filter((v) => v.key !== key);
                update({
                  variants: [...others, { key, description }].sort((l, r) =>
                    l.key.localeCompare(r.key),
                  ),
                });
              };
              return (
                <tr key={`${x.name}-${i}`}>
                  <td>
                    <Input
                      value={x.name}
                      disabled={!editable}
                      onChange={(e) => update({ name: e.target.value })}
                    />
                  </td>
                  <td>
                    <Input
                      value={x.hypothesis}
                      disabled={!editable}
                      onChange={(e) => update({ hypothesis: e.target.value })}
                    />
                  </td>
                  <td>
                    <OmaSelect
                      value={x.variable}
                      disabled={!editable}
                      options={EXPERIMENT_VARIABLES.map((v) => ({
                        value: v,
                        label: t(`strategy.plan.variable.${v}`),
                      }))}
                      onChange={(v) => update({ variable: v })}
                    />
                  </td>
                  <td>
                    <OmaSelect
                      value={x.audience_key ?? ''}
                      disabled={!editable}
                      options={audienceOptions}
                      onChange={(v) => update({ audience_key: v || null })}
                    />
                  </td>
                  <td>
                    <Input
                      value={variant('A')}
                      disabled={!editable}
                      onChange={(e) => setVariant('A', e.target.value)}
                    />
                  </td>
                  <td>
                    <Input
                      value={variant('B')}
                      disabled={!editable}
                      onChange={(e) => setVariant('B', e.target.value)}
                    />
                  </td>
                  <td>
                    <Input
                      value={x.primary_metric}
                      disabled={!editable}
                      onChange={(e) => update({ primary_metric: e.target.value })}
                    />
                  </td>
                  <td>
                    <SourceTag source={x.source} t={t} />
                  </td>
                  <td>
                    {editable ? (
                      <Button
                        type="text"
                        onClick={() =>
                          set(
                            'experiments',
                            plan.experiments.filter((_, j) => j !== i),
                          )
                        }
                      >
                        {t('strategy.plan.remove')}
                      </Button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {editable ? (
        <Button
          onClick={() =>
            set('experiments', [
              ...plan.experiments,
              {
                name: '',
                hypothesis: '',
                variable: 'CREATIVE',
                variants: [
                  { key: 'A', description: '' },
                  { key: 'B', description: '' },
                ],
                primary_metric: 'CTR',
                source: 'MANUAL',
              },
            ])
          }
        >
          {t('strategy.plan.addExperiment')}
        </Button>
      ) : null}

      <h3>{t('strategy.plan.flights')}</h3>
      <p className="oma-muted">{t('strategy.plan.flightsHint')}</p>
      <div className="oma-plan-table-wrap">
        <table className="oma-plan-table" data-testid="plan-flights">
          <thead>
            <tr>
              <th>{t('strategy.plan.col.name')}</th>
              <th>{t('strategy.plan.col.platform')}</th>
              <th>{t('strategy.plan.col.audience')}</th>
              <th>{t('strategy.plan.col.start')}</th>
              <th>{t('strategy.plan.col.end')}</th>
              <th>{t('strategy.plan.col.budget')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(plan.flights ?? []).map((f, i) => {
              const update = (patch: Partial<typeof f>) => {
                const rows = [...(plan.flights ?? [])];
                rows[i] = { ...f, ...patch };
                set('flights', rows);
              };
              return (
                <tr key={`${f.key}-${i}`}>
                  <td>
                    <Input
                      value={f.name}
                      disabled={!editable}
                      onChange={(e) => update({ name: e.target.value })}
                    />
                  </td>
                  <td>
                    <OmaSelect
                      value={f.platform}
                      disabled={!editable}
                      options={options(PAID_PLATFORMS)}
                      onChange={(v) => update({ platform: v })}
                    />
                  </td>
                  <td>
                    <OmaSelect
                      value={f.audience_key ?? ''}
                      disabled={!editable}
                      options={audienceOptions}
                      onChange={(v) => update({ audience_key: v || null })}
                    />
                  </td>
                  <td>
                    <Input
                      type="date"
                      value={f.start_date}
                      disabled={!editable}
                      onChange={(e) => update({ start_date: e.target.value })}
                    />
                  </td>
                  <td>
                    <Input
                      type="date"
                      value={f.end_date}
                      disabled={!editable}
                      onChange={(e) => update({ end_date: e.target.value })}
                    />
                  </td>
                  <td>
                    <Input
                      type="number"
                      value={f.budget_amount ?? ''}
                      disabled={!editable}
                      onChange={(e) =>
                        update({
                          budget_amount: e.target.value === '' ? null : Number(e.target.value),
                          currency: currency ?? f.currency ?? null,
                        })
                      }
                    />
                  </td>
                  <td>
                    {editable ? (
                      <Button
                        type="text"
                        onClick={() =>
                          set(
                            'flights',
                            (plan.flights ?? []).filter((_, j) => j !== i),
                          )
                        }
                      >
                        {t('strategy.plan.remove')}
                      </Button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {editable ? (
        <Button
          onClick={() => {
            const rows = plan.flights ?? [];
            const today = new Date().toISOString().slice(0, 10);
            const end = new Date(Date.now() + 27 * 86_400_000).toISOString().slice(0, 10);
            let n = rows.length + 1;
            while (rows.some((r) => r.key === `flight-${n}`)) n += 1;
            set('flights', [
              ...rows,
              {
                key: `flight-${n}`,
                name: '',
                platform: PAID_PLATFORMS[0]!,
                start_date: today,
                end_date: end,
                budget_amount: null,
                currency: currency ?? null,
              },
            ]);
          }}
        >
          {t('strategy.plan.addFlight')}
        </Button>
      ) : null}
    </>
  );
}
