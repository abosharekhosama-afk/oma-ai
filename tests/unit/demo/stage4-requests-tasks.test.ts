import { describe, expect, it } from 'vitest';
import { DEMO_GRAPH, DemoDataProvider } from '@oma/demo';
import {
  briefIsReady,
  canTransitionRequestStatus,
  filterRequests,
  requestCompleteness,
  requestIsOverdue,
  requestMissingFields,
  EMPTY_REQUEST_FILTERS,
} from '../../../apps/web/src/lib/demo/stage4-requests';
import {
  BOARD_COLUMNS,
  canTransitionTaskStatus,
  checklistProgress,
  filterTasks,
  groupTasksByBoard,
  taskIsOverdue,
  EMPTY_TASK_FILTERS,
} from '../../../apps/web/src/lib/demo/stage4-tasks';

describe('stage4 requests helpers', () => {
  it('flags unassigned/missing/overdue requests', () => {
    const open = DEMO_GRAPH.requests.find((r) => r.id === 'demo-request-4')!;
    expect(requestMissingFields(open)).toContain('assignee');
    expect(requestMissingFields(open)).toContain('brief');
    const urgent = DEMO_GRAPH.requests.find((r) => r.id === 'demo-request-5')!;
    expect(requestIsOverdue(urgent)).toBe(true);
  });

  it('filters and groups requests', () => {
    const filtered = filterRequests(
      DEMO_GRAPH.requests,
      { ...EMPTY_REQUEST_FILTERS, group: 'untriaged' },
      'en',
    );
    expect(filtered.every((r) => r.status === 'OPEN' && !r.assignee)).toBe(true);
    const search = filterRequests(
      DEMO_GRAPH.requests,
      { ...EMPTY_REQUEST_FILTERS, q: 'autumn' },
      'en',
    );
    expect(search.some((r) => r.id === 'demo-request-1')).toBe(true);
  });

  it('computes brief readiness and request completeness', () => {
    const brief = DEMO_GRAPH.briefs.find((b) => b.id === 'demo-brief-1')!;
    expect(briefIsReady(brief)).toBe(true);
    const incomplete = DEMO_GRAPH.briefs.find((b) => b.id === 'demo-brief-2')!;
    expect(briefIsReady(incomplete)).toBe(false);
    const req = DEMO_GRAPH.requests.find((r) => r.id === 'demo-request-1')!;
    expect(requestCompleteness(req, brief)).toBeGreaterThan(70);
  });

  it('validates request transitions', () => {
    expect(canTransitionRequestStatus('OPEN', 'ASSIGNED')).toBe(true);
    expect(canTransitionRequestStatus('CLOSED', 'OPEN')).toBe(false);
  });
});

describe('stage4 tasks helpers', () => {
  it('groups board columns including OVERDUE under IN_PROGRESS', () => {
    const grouped = groupTasksByBoard(DEMO_GRAPH.tasks);
    expect(BOARD_COLUMNS.map((c) => c.id)).toEqual([
      'BACKLOG',
      'READY',
      'IN_PROGRESS',
      'IN_REVIEW',
      'BLOCKED',
      'DONE',
    ]);
    expect(grouped.IN_PROGRESS.some((t) => t.id === 'demo-task-overdue')).toBe(true);
  });

  it('checklist progress and overdue', () => {
    const task = DEMO_GRAPH.tasks.find((t) => t.id === 'demo-task-design')!;
    expect(checklistProgress(task)).toEqual({ done: 2, total: 3, pct: 67 });
    expect(taskIsOverdue(DEMO_GRAPH.tasks.find((t) => t.id === 'demo-task-overdue')!)).toBe(true);
  });

  it('filters tasks and validates transitions', () => {
    const blocked = filterTasks(
      DEMO_GRAPH.tasks,
      { ...EMPTY_TASK_FILTERS, status: 'BLOCKED' },
      'en',
    );
    expect(blocked.every((t) => t.status === 'BLOCKED')).toBe(true);
    expect(canTransitionTaskStatus('BACKLOG', 'READY')).toBe(true);
    expect(canTransitionTaskStatus('DONE', 'IN_REVIEW')).toBe(false);
  });
});

describe('stage4 request→task conversion idempotency', () => {
  it('creates tasks once then returns the same conversion set', () => {
    const provider = new DemoDataProvider();
    const created = provider.createRequest({
      title: { en: 'Convert me', ar: 'حوّلني' },
      description: { en: 'Full brief path', ar: 'مسار موجز كامل' },
      type: 'DESIGN',
      brandId: 'demo-brand-horizon',
      campaignId: 'demo-campaign-organic',
      priority: 'HIGH',
      dueAt: '2026-09-30',
      requester: 'Test Owner',
      assignee: 'Layla Haddad',
      channels: ['Instagram'],
      formats: ['Static'],
    });
    provider.upsertBrief(created.id, {
      overview: { en: 'Overview', ar: 'نظرة' },
      objective: { en: 'Objective', ar: 'هدف' },
      audience: { en: 'Audience', ar: 'جمهور' },
      keyMessage: { en: 'Message', ar: 'رسالة' },
      deliverableType: { en: 'Static', ar: 'ثابت' },
      channels: ['Instagram'],
      formats: ['1080'],
      tone: { en: 'Calm', ar: 'هادئ' },
      mandatory: { en: 'Logo', ar: 'شعار' },
      cta: { en: 'Shop', ar: 'تسوق' },
      acceptance: { en: 'Approved', ar: 'معتمد' },
      readiness: 'READY',
    });
    const first = provider.convertBriefToTasks(created.id);
    const second = provider.convertBriefToTasks(created.id);
    expect(first.map((t) => t.id)).toEqual(second.map((t) => t.id));
    expect(first.length).toBe(1);
    const req = provider.getRequest(created.id)!;
    expect(req.conversionTaskIds).toEqual(first.map((t) => t.id));
    expect(req.status).toBe('IN_PRODUCTION');
  });
});
