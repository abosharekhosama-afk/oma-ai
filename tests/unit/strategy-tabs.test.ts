import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  activeStrategyTab,
  isActiveSection,
  strategyTabs,
} from '../../apps/web/src/lib/strategy-tabs';

const base = '/app/brands/b1/strategies/s1';
const tabs = strategyTabs('b1', 's1');

describe('DEC-029 4.9 strategy tabs', () => {
  it('has exactly three tabs', () => {
    expect(tabs.map((t) => t.id)).toEqual(['plan', 'execution', 'review']);
  });

  it.each([
    [base, 'plan'],
    [`${base}/edit`, 'plan'],
    [`${base}/organic`, 'plan'],
    [`${base}/paid`, 'plan'],
    [`${base}/evidence`, 'plan'],
    [`${base}/execution`, 'execution'],
    [`${base}/review`, 'review'],
    [`${base}/versions`, 'review'],
    [`${base}/versions/v9`, 'review'],
  ])('%s → %s (old routes still resolve to a tab)', (path, tab) => {
    expect(activeStrategyTab(tabs, path)).toBe(tab);
  });

  it('overview section is exact-match only', () => {
    const overview = tabs[0]!.sections[0]!;
    expect(isActiveSection(base, overview)).toBe(true);
    expect(isActiveSection(`${base}/paid`, overview)).toBe(false);
  });

  it('renders the AI assistant on exactly one strategy page', () => {
    const dir = join(
      __dirname,
      '../../apps/web/src/app/(app)/app/brands/[brandId]/strategies/[strategyId]',
    );
    const pages = [
      'page.tsx',
      ...readdirSync(dir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => join(d.name, 'page.tsx')),
    ];
    const withAssistant = pages.filter((p) => {
      try {
        return readFileSync(join(dir, p), 'utf8').includes('<StrategyAiAssistant');
      } catch {
        return false;
      }
    });
    expect(withAssistant).toEqual(['page.tsx']);
  });
});
