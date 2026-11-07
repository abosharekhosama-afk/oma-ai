import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Content Preview Feed-style circular rail, clean preview card, per-platform URL & Owner workspace creation', () => {
  it('uses Feed-style circular platform badges (.oma-fp__net) in the preview rail and status circle', () => {
    const contentClient = readFileSync(
      resolve('apps/web/src/app/(app)/app/content/content-client.tsx'),
      'utf8',
    );
    expect(contentClient).toContain('className="oma-plan-post__rail-av oma-fp__net"');
    expect(contentClient).toContain(
      'className="oma-pv-modal-status-circle oma-pv-modal-status-circle--net oma-fp__net"',
    );
  });

  it('renders only the preview card inside .oma-pv-modal-post without the extra Open/Tip/Smile/Repeat wrapper bar', () => {
    const contentClient = readFileSync(
      resolve('apps/web/src/app/(app)/app/content/content-client.tsx'),
      'utf8',
    );
    expect(contentClient).not.toContain('oma-pv-modal-actions');
    expect(contentClient).not.toContain('content-preview-smile');
  });

  it('resolves per-channel external post URLs using publishTargets network and external_post_id', () => {
    const contentService = readFileSync(resolve('apps/api/src/content/content.service.ts'), 'utf8');
    expect(contentService).toContain('socialPage: { select: { network: true } }');
    expect(contentService).toContain('external_post_id: t.externalPostId ?? null');

    const contentClient = readFileSync(
      resolve('apps/web/src/app/(app)/app/content/content-client.tsx'),
      'utf8',
    );
    expect(contentClient).toContain('primaryUrlMatchesActiveChannel');
    expect(contentClient).toContain('resolvedTargetUrl');
  });

  it('allows Company Owners and Workspace Admins (tenant.manage / Owner role) to create additional workspaces', () => {
    const tenantService = readFileSync(resolve('apps/api/src/tenant/tenant.service.ts'), 'utf8');
    expect(tenantService).toContain("grantedCaps.includes('tenant.manage')");
    expect(tenantService).toContain("g.sourceProfileCode === 'COMPANY_OWNER'");
  });
});
