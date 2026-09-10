import { describe, expect, it } from 'vitest';

describe('feature 003 scope boundary', () => {
  it('documents surfaces deferred out of Feature 003', () => {
    const deferred = [
      'calendar',
      'kanban',
      'creative upload',
      'publish',
      'ad account connect',
      'live keyword crawl',
    ];
    expect(deferred).toHaveLength(6);
    expect(deferred).not.toContain('strategy package approve');
  });
});
