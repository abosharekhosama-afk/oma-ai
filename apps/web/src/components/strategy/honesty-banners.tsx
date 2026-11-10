'use client';
import { useT } from '../../lib/use-locale';

export function AiHonestyBanner({ availability }: { availability?: string }) {
  const t = useT();
  const live = availability === 'AVAILABLE';
  return (
    <p className="oma-muted" role="note" data-testid="strategy-ai-disclosure">
      {live ? t('strategy.warning.aiAvailable') : t('strategy.warning.aiNotConfigured')}
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
