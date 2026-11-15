import { describe, expect, it } from 'vitest';
import { computeMenuPlacement } from '../../packages/ui/src/controls';

const desktop = { width: 1280, height: 800 };
const phone = { width: 390, height: 844 };

describe('SelectField floating menu placement', () => {
  it('opens below the trigger with fixed coordinates', () => {
    const p = computeMenuPlacement({ top: 100, bottom: 136, left: 400, width: 220 }, desktop);
    expect(p).toMatchObject({ top: 140, bottom: null, left: 400, width: 220, maxHeight: 260 });
  });

  it('flips upward near the bottom of the viewport', () => {
    const p = computeMenuPlacement({ top: 720, bottom: 756, left: 40, width: 200 }, desktop);
    expect(p.top).toBeNull();
    expect(p.bottom).toBe(800 - 720 + 4);
    expect(p.maxHeight).toBe(260);
  });

  it('stays inside a phone viewport horizontally', () => {
    const p = computeMenuPlacement({ top: 300, bottom: 340, left: 300, width: 120 }, phone);
    expect(p.width).toBe(160);
    expect(p.left + p.width).toBeLessThanOrEqual(phone.width - 8);
    expect(p.left).toBeGreaterThanOrEqual(8);
  });

  it('never gets narrower than the trigger or wider than the screen', () => {
    const p = computeMenuPlacement({ top: 10, bottom: 50, left: 0, width: 600 }, phone);
    expect(p.width).toBe(phone.width - 16);
    expect(p.left).toBe(8);
  });
});
