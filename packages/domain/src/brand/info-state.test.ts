import { describe, expect, it } from 'vitest';
import { canTransitionInfoState, infoStateAfterAccept } from './info-state';

describe('info-state', () => {
  it('accept promotes observed/ai to confirmed', () => {
    expect(infoStateAfterAccept('OBSERVED')).toBe('USER_CONFIRMED');
    expect(infoStateAfterAccept('AI_INFERRED')).toBe('USER_CONFIRMED');
  });

  it('blocks invalid transitions', () => {
    expect(canTransitionInfoState('USER_CONFIRMED', 'OBSERVED')).toBe(false);
  });
});
