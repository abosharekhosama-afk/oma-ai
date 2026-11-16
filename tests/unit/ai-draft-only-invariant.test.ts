import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { aiWriteViolation, assertAiWriteTarget, assertHumanActor } from '@oma/domain';

const ROOT = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

/** Modules whose only job is to run AI or apply its output. */
const AI_ONLY_MODULES = [
  'apps/api/src/ai/structured-run.ts',
  'apps/api/src/ai/content-generation.service.ts',
  'apps/api/src/ai/ai.service.ts',
  'apps/worker/src/brand/brand-analysis.service.ts',
  'packages/domain/src/ai/apply-proposal.ts',
];

/** Methods in mixed services that apply AI output. */
const AI_METHODS: Array<[string, string, RegExp]> = [
  ['apps/api/src/strategy/strategy.service.ts', 'aiPropose(', /assertHumanActor|requireVersion/],
  ['apps/api/src/strategy/strategy.service.ts', 'aiProposeAccept(', /assertAiWriteTarget/],
  ['apps/api/src/strategy/strategy.service.ts', 'aiProposeReject(', /assertHumanActor/],
  ['apps/api/src/strategy/strategy-plan.service.ts', 'acceptProposal(', /guardedWrite/],
];

const FORBIDDEN_WRITE =
  /status:\s*['"](APPROVED|SUPERSEDED|PUBLISHED|SCHEDULED|PUBLISHED_SAMPLE)['"]|reviewStatus:\s*['"](ACCEPTED|APPROVED)['"]/;

/** Strip comments so documentation can mention statuses. */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function methodBody(source: string, signature: string): string {
  const start = source.indexOf(`  async ${signature}`);
  if (start < 0) throw new Error(`method not found: ${signature}`);
  const next = source.indexOf('\n  async ', start + 10);
  return source.slice(start, next < 0 ? undefined : next);
}

/** Status writes inside Prisma `data:` blocks. Reads (`where:`) are fine. */
function forbiddenDataWrites(body: string): string[] {
  const hits: string[] = [];
  const re = /data:\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    let depth = 1;
    let i = m.index + m[0].length;
    while (i < body.length && depth > 0) {
      if (body[i] === '{') depth += 1;
      else if (body[i] === '}') depth -= 1;
      i += 1;
    }
    const block = body.slice(m.index, i);
    const hit = FORBIDDEN_WRITE.exec(block);
    if (hit) hits.push(hit[0]);
  }
  return hits;
}

describe('draft-only invariant: static scan', () => {
  it.each(AI_ONLY_MODULES)('%s never writes an approved/published/scheduled status', (file) => {
    expect(forbiddenDataWrites(code(read(file)))).toEqual([]);
  });

  it.each(AI_METHODS)('%s %s stays draft-only and is guarded', (file, signature, guard) => {
    const body = code(methodBody(read(file), signature));
    expect(forbiddenDataWrites(body)).toEqual([]);
    expect(body).toMatch(guard);
  });

  it('the scanner catches a forbidden write', () => {
    expect(forbiddenDataWrites("await tx.x.update({ data: { status: 'APPROVED' } })")).toHaveLength(
      1,
    );
    expect(forbiddenDataWrites("findFirst({ where: { status: 'APPROVED' } })")).toHaveLength(0);
  });
});

describe('assertAiWriteTarget', () => {
  it('allows drafts, pending claims and the run row', () => {
    expect(aiWriteViolation({ kind: 'ai_run' })).toBeNull();
    expect(aiWriteViolation({ kind: 'profile_version', status: 'DRAFT' })).toBeNull();
    expect(aiWriteViolation({ kind: 'profile_version', status: 'NEEDS_REVIEW' })).toBeNull();
    expect(aiWriteViolation({ kind: 'insight_claim', reviewStatus: 'PENDING' })).toBeNull();
    expect(
      aiWriteViolation({ kind: 'strategy_version', status: 'DRAFT', humanActorId: 'u1' }),
    ).toBeNull();
    expect(aiWriteViolation({ kind: 'content_item', status: 'DRAFT' })).toBeNull();
  });

  it('refuses approved, superseded, scheduled and published targets', () => {
    for (const status of ['APPROVED', 'SUPERSEDED']) {
      expect(() => assertAiWriteTarget({ kind: 'profile_version', status })).toThrow(/AI cannot/);
    }
    expect(aiWriteViolation({ kind: 'insight_claim', reviewStatus: 'ACCEPTED' })).toMatch(
      /PENDING/,
    );
    expect(aiWriteViolation({ kind: 'content_item', status: 'SCHEDULED' })).toBeTruthy();
    expect(aiWriteViolation({ kind: 'content_item', status: 'APPROVED' })).toBeTruthy();
    expect(
      aiWriteViolation({ kind: 'strategy_version', status: 'APPROVED', humanActorId: 'u1' }),
    ).toBeTruthy();
  });

  it('a strategy write needs a human actor', () => {
    expect(aiWriteViolation({ kind: 'strategy_version', status: 'DRAFT' })).toMatch(/human/);
    expect(() => assertHumanActor(undefined)).toThrow();
    expect(() => assertHumanActor('unknown')).toThrow();
    expect(() => assertHumanActor('u1')).not.toThrow();
  });
});
