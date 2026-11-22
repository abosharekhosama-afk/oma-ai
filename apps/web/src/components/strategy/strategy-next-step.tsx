'use client';

import { Button } from '@oma/ui/controls';
import { usePathname, useRouter } from 'next/navigation';
import type { StrategyJourney } from '@oma/domain/browser';
import { journeyActionHref } from '../../lib/strategy-readiness';
import { useT } from '../../lib/use-locale';

/**
 * Guided five-step strip shown at the top of the strategy workspace:
 * Foundation → Plan → Send for review → Approve → Calendar & briefs.
 * Shows where the user is and exactly one primary action.
 */
export function StrategyNextStep({
  brandId,
  strategyId,
  journey,
  status,
}: {
  brandId: string;
  strategyId: string;
  journey: StrategyJourney | null | undefined;
  status: string | null | undefined;
}) {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();
  if (!journey) return null;
  const current = journey.current;
  const index = current ? journey.steps.findIndex((s) => s.id === current) : -1;
  const revise = current === 'submit' && (status === 'CHANGES_REQUESTED' || status === 'REJECTED');
  const hintKey = current
    ? revise
      ? 'strategy.next.hint.revise'
      : `strategy.next.hint.${current}`
    : 'strategy.next.allDone';
  const href = current ? journeyActionHref(brandId, strategyId, current) : null;
  const onTarget = href ? pathname === href.split('#')[0] && !href.includes('#') : false;
  const actionKey = current
    ? revise
      ? 'strategy.next.action.revise'
      : `strategy.next.action.${current}`
    : null;

  return (
    <section
      className="oma-strategy-next oma-card"
      data-testid="strategy-next-step"
      data-current={current ?? 'done'}
      aria-label={t('strategy.next.title')}
    >
      <ol className="oma-strategy-next__steps">
        {journey.steps.map((step, i) => (
          <li
            key={step.id}
            className="oma-strategy-next__step"
            data-state={step.state}
            aria-current={step.state === 'current' ? 'step' : undefined}
            data-testid={`strategy-next-step-${step.id}`}
          >
            <span className="oma-strategy-next__dot" aria-hidden>
              {step.state === 'done' ? '✓' : i + 1}
            </span>
            <span className="oma-strategy-next__label">{t(`strategy.next.step.${step.id}`)}</span>
          </li>
        ))}
      </ol>
      <div className="oma-strategy-next__body">
        <div>
          <p className="oma-strategy-next__title">
            {t('strategy.next.title')}
            {index >= 0 ? (
              <span className="oma-muted">
                {' · '}
                {t('strategy.next.progress')
                  .replace('{current}', String(index + 1))
                  .replace('{total}', String(journey.steps.length))}
              </span>
            ) : null}
          </p>
          <p className="oma-muted oma-strategy-next__hint">{t(hintKey)}</p>
        </div>
        {href && actionKey && !onTarget ? (
          <Button
            type="primary"
            className="oma-strategy-next__action"
            data-testid="strategy-next-action"
            onClick={() => router.push(href)}
          >
            {t(actionKey)}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
