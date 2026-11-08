import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateSettingsPatch } from '../../apps/api/src/workspace/workspace-settings.controller';
import {
  LISTENING_PLATFORMS,
  platformLabel,
} from '../../apps/web/src/app/(app)/app/listening/listening-utils';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

describe('listening gap closure', () => {
  it('accepts slack webhook in workspace settings', () => {
    const out = validateSettingsPatch({
      listening_slack_webhook_url: 'https://hooks.slack.com/services/T00/B00/xxx',
    });
    expect(out.listeningSlackWebhookUrl).toContain('hooks.slack.com');
  });

  it('rejects non-slack webhook urls', () => {
    expect(() =>
      validateSettingsPatch({ listening_slack_webhook_url: 'https://example.com/hook' }),
    ).toThrow();
  });

  it('exposes Planable-style public platforms in source menu list', () => {
    const ids = LISTENING_PLATFORMS.map((p) => p.id);
    expect(ids).toContain('REDDIT');
    expect(ids).toContain('WEB');
    expect(ids).toContain('YOUTUBE');
    expect(platformLabel('REDDIT')).toBe('Reddit');
  });

  it('polls X, Reddit, YouTube, web, TikTok, and LinkedIn from public sources', () => {
    const src = read('apps/worker/src/listening/public-sources-poll.ts');
    expect(src).toContain('async function pollX');
    expect(src).toContain('tweets/search/recent');
    expect(src).toContain('oauth.reddit.com/search');
    expect(src).toContain('async function pollTikTokResearch');
    expect(src).toContain("site: 'linkedin.com'");
    expect(src).toContain("site: 'tiktok.com'");
    const meta = read('apps/worker/src/listening/meta-poll.ts');
    expect(meta).toContain("page.network === 'X'");
    expect(meta).toContain('/mentions?');
  });
});
