import { describe, expect, it } from 'vitest';
import { isBrandFixtureConnectorEnabled } from '@oma/domain';

describe('fixture connector env guard', () => {
  it('allows fixture connector in test when flag is set', () => {
    expect(isBrandFixtureConnectorEnabled({ BRAND_FIXTURE_CONNECTOR: '1', NODE_ENV: 'test' })).toBe(
      true,
    );
  });

  it('blocks fixture connector in production even when flag is set', () => {
    expect(
      isBrandFixtureConnectorEnabled({ BRAND_FIXTURE_CONNECTOR: '1', NODE_ENV: 'production' }),
    ).toBe(false);
  });
});
