'use client';

import { useT } from '../../lib/use-locale';

/**
 * States which website connector is available so fixture results are never
 * mistaken for a live fetch, and live scans are labeled honestly.
 */
export type ConnectorMode = 'FIXTURE' | 'NOT_CONFIGURED' | 'LIVE';

/**
 * Compact form for screens that list crawl output, where a full banner above
 * every table would crowd the data but the provenance still has to be stated.
 */
export function ConnectorModeChip({ mode }: { mode: ConnectorMode | null | undefined }) {
  const t = useT();
  if (!mode) return null;
  if (mode === 'LIVE') {
    return null;
  }
  return (
    <span className="oma-badge oma-badge-warning" title={t('brand.connector.noLiveTitle')}>
      {mode === 'FIXTURE'
        ? t('brand.connector.fixtureChip')
        : t('brand.connector.notConfiguredChip')}
    </span>
  );
}

export function ConnectorModeBanner({
  mode,
  compact = false,
}: {
  mode: ConnectorMode;
  /** Scan / discovery: one-line provenance instead of a full-height banner. */
  compact?: boolean;
}) {
  const t = useT();
  if (mode === 'LIVE') {
    return null;
  }
  if (compact) {
    return (
      <p className="oma-plx-brand-connector-note oma-plx-brand-connector-note--warn" role="note">
        <ConnectorModeChip mode={mode} />
        <span className="oma-muted">
          {mode === 'FIXTURE'
            ? t('brand.connector.fixtureBody')
            : t('brand.connector.notConfiguredBody')}
        </span>
      </p>
    );
  }
  return (
    <div className="oma-banner oma-banner-warning" role="note">
      <strong>{t('brand.connector.noLiveTitle')}</strong>
      <p>
        {mode === 'FIXTURE'
          ? t('brand.connector.fixtureBody')
          : t('brand.connector.notConfiguredBody')}
      </p>
    </div>
  );
}
