/** Fixture website connector is allowed only outside production runtime. */
export function isBrandFixtureConnectorEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.BRAND_FIXTURE_CONNECTOR === '1' && env.NODE_ENV !== 'production';
}
