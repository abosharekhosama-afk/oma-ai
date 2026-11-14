import { describe, expect, it } from 'vitest';
import {
  readFoundationText,
  readTrackList,
  textToFoundationGoals,
  textToTrackList,
  trackListToText,
} from '../../apps/web/src/lib/strategy-foundation-format';

describe('strategy-foundation-format', () => {
  it('readFoundationText joins string and object goals', () => {
    expect(readFoundationText('One')).toBe('One');
    expect(readFoundationText([{ value: 'A' }, 'B'])).toBe('A\nB');
    expect(readFoundationText({ value: 'Position' })).toBe('Position');
  });

  it('readTrackList and trackListToText round-trip', () => {
    const raw = ['x', { value: 'y', infoClass: 'AI_PROPOSED' }];
    expect(readTrackList(raw)).toEqual(['x', 'y']);
    expect(trackListToText(raw)).toBe('x\ny');
  });

  it('textToFoundationGoals uses USER_AUTHORED', () => {
    expect(textToFoundationGoals('a\nb')).toEqual([
      { value: 'a', infoClass: 'USER_AUTHORED' },
      { value: 'b', infoClass: 'USER_AUTHORED' },
    ]);
    expect(textToTrackList('  one \n\n two ')).toEqual(['one', 'two']);
  });
});
