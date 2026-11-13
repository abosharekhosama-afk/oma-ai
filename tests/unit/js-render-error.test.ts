import { describe, expect, it } from 'vitest';
import { classifyJsRenderError } from '@oma/domain';

describe('classifyJsRenderError', () => {
  it('maps generic Error to RENDER_FAILED with message', () => {
    const out = classifyJsRenderError(new Error('page.goto: Timeout 30000ms exceeded'));
    expect(out.code).toBe('RENDER_TIMEOUT');
  });

  it('never returns code Error', () => {
    const out = classifyJsRenderError(new Error('something broke'));
    expect(out.code).not.toBe('Error');
    expect(out.code).toBe('RENDER_FAILED');
  });
});
