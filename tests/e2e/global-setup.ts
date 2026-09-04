import { config as loadDotenv } from 'dotenv';

loadDotenv();

export default async function globalSetup() {
  const url = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL ?? '';
  if (/prod|production|rds\.amazonaws|azure\.com/i.test(url) && !/127\.0\.0\.1|localhost/.test(url)) {
    throw new Error('Refusing E2E globalSetup against production DATABASE_URL');
  }
  const e2eUrl =
    process.env.E2E_DATABASE_URL ??
    'postgresql://oma@127.0.0.1:5432/oma_ai_e2e?schema=public';
  process.env.DATABASE_URL = e2eUrl;
  if (!/oma_ai_e2e/i.test(e2eUrl) && process.env.OMA_E2E_ALLOW_DEV_DB !== '1') {
    throw new Error('E2E globalSetup requires oma_ai_e2e database');
  }
  console.log(`[e2e] using database ${e2eUrl.replace(/:[^:@/]+@/, ':***@')}`);
}
