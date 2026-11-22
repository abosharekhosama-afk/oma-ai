import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STRATEGY_BLOCKING_CODES } from '@oma/domain';

const ROOT = join(__dirname, '..', '..');
const load = (l: string) =>
  JSON.parse(readFileSync(join(ROOT, `packages/i18n/messages/${l}.json`), 'utf8')) as Record<
    string,
    string
  >;

describe('strategy readiness copy (EN/AR)', () => {
  const en = load('en');
  const ar = load('ar');
  const keys = [
    ...STRATEGY_BLOCKING_CODES.map((c) => `strategy.blocker.${c}`),
    ...['foundation', 'plan', 'submit', 'approve', 'execute'].flatMap((s) => [
      `strategy.next.step.${s}`,
      `strategy.next.hint.${s}`,
      `strategy.next.action.${s}`,
    ]),
    'strategy.next.hint.revise',
    'strategy.next.action.revise',
    'errors.strategy_submit_blocked',
  ];
  it('every blocking code and guided step has plain EN and AR copy', () => {
    for (const k of keys) {
      expect(en[k], k).toBeTruthy();
      expect(ar[k], k).toMatch(/[\u0600-\u06FF]/);
      // never show raw codes to the user
      expect(en[k], k).not.toMatch(/\b[A-Z]{3,}_[A-Z_]{2,}\b/);
    }
  });
});
