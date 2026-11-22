'use client';

import Link from 'next/link';
import type { StrategyBlockingItem } from '@oma/domain/browser';
import { strategyBase } from '../../lib/strategy-readiness';
import { useT } from '../../lib/use-locale';

/**
 * Plain-language list of what still blocks submit/approve, each with a link to
 * the exact field to fix. Replaces the generic "can't be approved yet" error.
 */
export function StrategySubmitBlockers({
  brandId,
  strategyId,
  action,
  items,
  unknownsChecked,
}: {
  brandId: string;
  strategyId: string;
  action: 'submit' | 'approve';
  items: StrategyBlockingItem[];
  /** The assumptions box is ticked on screen (it is sent with the request). */
  unknownsChecked: boolean;
}) {
  const t = useT();
  const base = strategyBase(brandId, strategyId);
  const visible = items.filter((i) => !(unknownsChecked && i.code === 'UNKNOWNS_ACK_REQUIRED'));
  if (visible.length === 0) {
    return (
      <p
        className="oma-strategy-blockers oma-strategy-blockers--ok"
        data-testid="strategy-ready"
        role="status"
      >
        {t(action === 'approve' ? 'strategy.blocker.readyApprove' : 'strategy.blocker.ready')}
      </p>
    );
  }
  return (
    <section
      className="oma-strategy-blockers"
      data-testid="strategy-blockers"
      role="alert"
      aria-live="polite"
    >
      <p className="oma-strategy-blockers__title">
        {t(action === 'approve' ? 'strategy.blocker.titleApprove' : 'strategy.blocker.title')}
      </p>
      <p className="oma-muted">{t('strategy.blocker.intro')}</p>
      <ul className="oma-strategy-blockers__list">
        {visible.map((item) => (
          <li key={item.code} data-testid={`strategy-blocker-${item.code}`}>
            <span>{t(`strategy.blocker.${item.code}`)}</span>{' '}
            {item.code === 'UNKNOWNS_ACK_REQUIRED' ? null : (
              <Link className="oma-text-link" href={`${base}${item.fix_path}`}>
                {t('strategy.blocker.fix')}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
