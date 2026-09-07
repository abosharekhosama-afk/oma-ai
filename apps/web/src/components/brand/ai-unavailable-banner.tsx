'use client';

import { useT } from '../../lib/use-locale';

type AiUnavailableBannerProps = {
  aiAvailability: string;
};

export function AiUnavailableBanner({ aiAvailability }: AiUnavailableBannerProps) {
  const t = useT();
  if (aiAvailability !== 'NOT_CONFIGURED' && aiAvailability !== 'UNAVAILABLE') return null;

  return (
    <div className="oma-banner oma-banner-warning" role="status">
      <strong>{t('brand.ai.unavailableTitle')}</strong>
      <p>{t('brand.ai.unavailableBody')}</p>
    </div>
  );
}
