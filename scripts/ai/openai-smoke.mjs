#!/usr/bin/env node
/**
 * Future live smoke. Refuses unless billing activation is explicit.
 * Never prints prompts, responses, or secrets.
 */
const ci = process.env.CI === 'true' || process.env.CI === '1';
const live = process.env.AI_LIVE_ENABLED === 'true';
const confirm = process.env.AI_SMOKE_CONFIRM === 'I_UNDERSTAND_BILLING';

if (ci || !live || !confirm) {
  console.error('OPENAI_LIVE_ACCESS: NOT_VERIFIED');
  console.error('Refusing smoke: CI, AI_LIVE_ENABLED, or billing confirmation is not satisfied.');
  process.exit(1);
}

console.log('status=blocked');
console.log('models=CONFIGURED_NOT_LIVE_VERIFIED');
console.log('billing=NOT_ENABLED');
process.exit(1);
