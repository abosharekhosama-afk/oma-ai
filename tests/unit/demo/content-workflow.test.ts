import { describe, expect, it } from 'vitest';
import { DemoDataProvider, DEMO_GRAPH, assertCanSchedule, resolveContentWorkflow } from '@oma/demo';

describe('content workflow separation', () => {
  it('keeps a dated draft unscheduled until the schedule command', () => {
    const provider = new DemoDataProvider(structuredClone(DEMO_GRAPH));
    const campaign = provider.getGraph().campaigns[0]!;
    const created = provider.createContent({
      title: { en: 'Dated draft', ar: 'مسودة بتاريخ' },
      campaignId: campaign.id,
      brandId: campaign.brandId,
      track: 'ORGANIC',
      channel: 'Instagram',
      contentType: 'POST',
      owner: 'Tester',
      scheduledAt: '2026-10-02T09:00:00.000Z',
      status: 'DRAFT',
    });
    const saved = provider.saveContentDraft(created.id, {
      plannedAt: '2026-10-03T09:00:00.000Z',
    });
    expect(saved?.scheduleState).toBe('UNSCHEDULED');
    expect(saved?.status).not.toBe('SCHEDULED');
    expect(resolveContentWorkflow(saved!).publishDisplay).toBe('PLANNED_DATE');
    const scheduled = provider.scheduleContent(created.id);
    expect('row' in scheduled).toBe(true);
    if ('row' in scheduled && scheduled.row) {
      expect(scheduled.row.scheduleState).toBe('SCHEDULED');
      expect(resolveContentWorkflow(scheduled.row).publishDisplay).toBe('SCHEDULED_LOCAL');
    }
  });

  it('blocks schedule when approval is required and missing', () => {
    const provider = new DemoDataProvider(structuredClone(DEMO_GRAPH));
    provider.updateDemoPreferences({ approvalPolicy: 'REQUIRED' });
    const campaign = provider.getGraph().campaigns[0]!;
    const created = provider.createContent({
      title: { en: 'Needs approval', ar: 'يحتاج اعتماد' },
      campaignId: campaign.id,
      brandId: campaign.brandId,
      track: 'ORGANIC',
      channel: 'Instagram',
      contentType: 'POST',
      owner: 'Tester',
      scheduledAt: '2026-10-04T09:00:00.000Z',
    });
    const blocked = provider.scheduleContent(created.id);
    expect(blocked).toEqual({ error: 'APPROVAL_REQUIRED' });
    const workflow = resolveContentWorkflow(provider.getContent(created.id)!, 'REQUIRED');
    expect(assertCanSchedule(workflow)).toBe('APPROVAL_REQUIRED');
    provider.updateContent(created.id, { approvalState: 'APPROVED', status: 'APPROVED' });
    const allowed = provider.scheduleContent(created.id);
    expect('row' in allowed && allowed.row?.scheduleState).toBe('SCHEDULED');
  });

  it('derives partial approval and blocks required scheduling', () => {
    const workflow = resolveContentWorkflow(
      {
        status: 'IN_REVIEW',
        scheduledAt: '2026-10-01T09:00:00.000Z',
        scheduleState: 'UNSCHEDULED',
        approverApproved: 1,
        approverRequired: 2,
      },
      'REQUIRED',
    );
    expect(workflow.approvalState).toBe('PARTIALLY_APPROVED');
    expect(workflow.publishDisplay).toBe('PARTIALLY_APPROVED');
    expect(assertCanSchedule(workflow)).toBe('APPROVAL_REQUIRED');
  });

  it('disables approval requests when policy is NONE', () => {
    const provider = new DemoDataProvider(structuredClone(DEMO_GRAPH));
    provider.updateDemoPreferences({ approvalPolicy: 'NONE' });
    const id = provider.getGraph().contentItems[0]!.id;
    expect(provider.requestContentApproval(id)).toEqual({ error: 'APPROVAL_DISABLED' });
  });
});
