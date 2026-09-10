import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('web honesty banners', () => {
  it('exports AiHonestyBanner and PaidPlanningBanner with stable testids', () => {
    const src = readFileSync(
      path.join(process.cwd(), 'apps/web/src/components/strategy/honesty-banners.tsx'),
      'utf8',
    );
    expect(src).toContain('strategy-ai-disclosure');
    expect(src).toContain('paid-planning-banner');
    expect(src).toContain('AiHonestyBanner');
    expect(src).toContain('PaidPlanningBanner');
  });
});
