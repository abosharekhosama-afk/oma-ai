import { config as loadDotenv } from 'dotenv';
import { cleanupE2eResidue } from './helpers/brand-api';

loadDotenv();

export default async function globalTeardown() {
  process.env.DATABASE_URL =
    process.env.E2E_DATABASE_URL ??
    process.env.DATABASE_URL ??
    'postgresql://oma@127.0.0.1:5432/oma_ai_e2e?schema=public';
  try {
    const result = await cleanupE2eResidue();
    console.log(`[e2e] cleaned memberships for ${result.tenants} tracked tenants`);
  } catch (err) {
    console.warn('[e2e] cleanup warning', err);
  }
}
