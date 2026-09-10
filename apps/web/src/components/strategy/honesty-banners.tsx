'use client';
import { useT } from '../../lib/use-locale';
export function AiHonestyBanner() {
  const t = useT();
  return (
    <p className="oma-muted" role="note" data-testid="strategy-ai-disclosure">
      {t('strategy.warning.aiNotConfigured')}
    </p>
  );
}
export function PaidPlanningBanner() {
  const t = useT();
  return (
    <div className="oma-card" role="note" data-testid="paid-planning-banner">
      <p>{t('strategy.warning.paidPlanningOnly')}</p>
    </div>
  );
}
