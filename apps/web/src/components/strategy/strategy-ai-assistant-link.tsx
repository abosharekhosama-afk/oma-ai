'use client';

import Link from 'next/link';
import { useT } from '../../lib/use-locale';

type Props = {
  brandId: string;
  strategyId: string;
};

/** DEC-029: single AI assistant on Plan overview — other strategy routes link here. */
export function StrategyAiAssistantLink({ brandId, strategyId }: Props) {
  const t = useT();
  const href = `/app/brands/${brandId}/strategies/${strategyId}#strategy-ai-assistant`;
  return (
    <p className="oma-muted" data-testid="strategy-ai-overview-link">
      <Link href={href}>{t('strategy.ai.openAssistant')}</Link>
    </p>
  );
}
