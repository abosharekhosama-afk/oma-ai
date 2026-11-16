import { describe, expect, it } from 'vitest';
import { appendAiRunId } from '../../apps/web/src/lib/content-ai';

describe('composer AI provenance (DEC-024)', () => {
  it('records the run id of live AI proposals only', () => {
    expect(appendAiRunId([], { source: 'ai', runId: 'r1' })).toEqual(['r1']);
    expect(appendAiRunId(['r1'], { source: 'ai', runId: 'r1' })).toEqual(['r1']);
    expect(appendAiRunId(['r1'], { source: 'ai', runId: 'r2' })).toEqual(['r1', 'r2']);
    expect(appendAiRunId(['r1'], { source: 'template', runId: null })).toEqual(['r1']);
    expect(appendAiRunId([], { source: 'ai', runId: null })).toEqual([]);
  });
});
