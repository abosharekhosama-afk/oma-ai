import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { approvalCounter } from '../../apps/web/src/components/content/feed-post';

const read = (p: string) => readFileSync(p, 'utf8');
const CLIENT = 'apps/web/src/app/(app)/app/content/content-client.tsx';

describe('content preview card', () => {
  it('plays videos with real controls in the detail preview', () => {
    const src = read('apps/web/src/components/content/post-preview.tsx');
    expect(src).toContain('controls={detail}');
    expect(src).not.toContain("autoPlay={ctx.size !== 'detail'}");
    // The decorative play badge would sit on top of the native controls.
    expect(src).toContain('&& show && !detail');
  });

  it('uses real approval data instead of a hardcoded counter', () => {
    const src = read(CLIENT);
    expect(src).not.toMatch(/<CheckOutlined \/>\s*<span>0<\/span>/);
    expect(src).not.toContain('approvalTipOpen');
    expect(src).toContain('variant="chip"');
    expect(src).toContain('testId="content-modal-approvals"');
    expect(src).toMatch(/\[selectedId, detailRev\]/);
    expect(approvalCounter({ approved: 1, required: 2, state: 'PARTIALLY_APPROVED' })).toBe('1/2');
  });

  it('lets the campaign chip pick and persist a campaign', () => {
    const src = read(CLIENT);
    expect(src).toContain('data-testid="content-modal-campaign-menu"');
    expect(src).toContain('updateContentProduction(contentId, { campaignId })');
    expect(src).toContain('assignCampaign(selected.id, null)');
  });
});
