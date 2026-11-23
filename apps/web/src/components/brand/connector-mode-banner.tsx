'use client';

import { useT } from '../../lib/use-locale';

/**
 * States which website connector is available so fixture results are never
 * mistaken for a live fetch, and live scans are labeled honestly.
 */
export type ConnectorMode = 'FIXTURE' | 'NOT_CONFIGURED' | 'LIVE';

export type ConnectorScanHint = {
  pages_fetched?: number;
  status?: string;
};

/** Demo stores label scans NOT_CONFIGURED even after a productive crawl — hide that noise. */
export function shouldShowConnectorChip(
  mode: ConnectorMode | null | undefined,
  scanHint?: ConnectorScanHint,
): boolean {
  if (!mode || mode === 'LIVE') return false;
  if (mode !== 'NOT_CONFIGURED' || !scanHint) return true;
  const fetched = scanHint.pages_fetched ?? 0;
  const status = scanHint.status ?? '';
  const productive =
    fetched > 0 || status === 'SUCCEEDED' || status === 'PARTIAL' || status === 'RUNNING';
  return !productive;
}

/**
 * Compact form for screens that list crawl output, where a full banner above
 * every table would crowd the data but the provenance still has to be stated.
 */
export function ConnectorModeChip({
  mode,
  scanHint,
}: {
  mode: ConnectorMode | null | undefined;
  scanHint?: ConnectorScanHint;
}) {
  const t = useT();
  if (!shouldShowConnectorChip(mode, scanHint)) return null;
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
