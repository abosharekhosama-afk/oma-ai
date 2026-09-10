'use client';
import { useT } from '../../lib/use-locale';
export function ConflictBanner({ show }: { show: boolean }) {
  const t = useT();
  if (!show) return null;
  return (
    <p role="alert" data-testid="strategy-conflict">
      {t('strategy.conflict')}
    </p>
  );
}
