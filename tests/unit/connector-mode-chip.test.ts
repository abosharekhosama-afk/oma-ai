import { describe, expect, it } from 'vitest';
import { shouldShowConnectorChip } from '../../apps/web/src/components/brand/connector-mode-banner';

describe('shouldShowConnectorChip', () => {
  it('hides LIVE', () => {
    expect(shouldShowConnectorChip('LIVE')).toBe(false);
  });

  it('shows FIXTURE after productive scan', () => {
    expect(shouldShowConnectorChip('FIXTURE', { pages_fetched: 12, status: 'SUCCEEDED' })).toBe(
      true,
    );
  });

  it('hides NOT_CONFIGURED when crawl produced pages', () => {
    expect(shouldShowConnectorChip('NOT_CONFIGURED', { pages_fetched: 3, status: 'PARTIAL' })).toBe(
      false,
    );
  });

  it('shows NOT_CONFIGURED when no pages yet', () => {
    expect(shouldShowConnectorChip('NOT_CONFIGURED', { pages_fetched: 0, status: 'RUNNING' })).toBe(
      false,
    );
    expect(shouldShowConnectorChip('NOT_CONFIGURED')).toBe(true);
  });
});
