import 'reflect-metadata';
import { config } from 'dotenv';
config({ path: '.env' });
process.env.BRAND_FIXTURE_CONNECTOR = process.env.BRAND_FIXTURE_CONNECTOR ?? '1';
