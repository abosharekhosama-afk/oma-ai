import { describe, expect, it } from 'vitest';
import { createFixtureWebsiteConnector } from '../ports/fixture-website-connector';
import { refusingWebsiteConnector } from '../ports/refusing-adapters';
import { isPrivateHostOverrideEnabled } from '../ports/live-website-connector';
import {
  brandConnectorMode,
  resolveBrandWebsiteConnectorChoice,
} from './website-connector-factory';

describe('website-connector-factory', () => {
  it('uses fixture when the legacy flag is on outside production', () => {
    expect(
      resolveBrandWebsiteConnectorChoice({ BRAND_FIXTURE_CONNECTOR: '1', NODE_ENV: 'test' }),
    ).toBe('fixture');
    expect(brandConnectorMode({ BRAND_FIXTURE_CONNECTOR: '1', NODE_ENV: 'test' })).toBe('FIXTURE');
  });

  it('defaults to live when no fixture flag is set', () => {
    expect(resolveBrandWebsiteConnectorChoice({ NODE_ENV: 'production' })).toBe('live');
    expect(brandConnectorMode({ NODE_ENV: 'production' })).toBe('LIVE');
  });

  it('never enables fixture or private hosts in production', () => {
    expect(
      resolveBrandWebsiteConnectorChoice({
        BRAND_WEBSITE_CONNECTOR: 'fixture',
        NODE_ENV: 'production',
      }),
    ).toBe('disabled');
    expect(
      isPrivateHostOverrideEnabled({
        BRAND_SCANNER_ALLOW_PRIVATE_HOSTS: '1',
        NODE_ENV: 'production',
      }),
    ).toBe(false);
    expect(
      isPrivateHostOverrideEnabled({ BRAND_SCANNER_ALLOW_PRIVATE_HOSTS: '1', NODE_ENV: 'test' }),
    ).toBe(true);
  });

  it('honors an explicit disabled choice', () => {
    expect(resolveBrandWebsiteConnectorChoice({ BRAND_WEBSITE_CONNECTOR: 'disabled' })).toBe(
      'disabled',
    );
    expect(refusingWebsiteConnector).toBeTruthy();
    expect(createFixtureWebsiteConnector()).toBeTruthy();
  });
});
