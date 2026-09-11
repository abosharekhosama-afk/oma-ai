import { describe, expect, it } from 'vitest';
import { DEMO_GRAPH, DemoDataProvider } from '@oma/demo';
import {
  EMPTY_DELIVERABLE_FILTERS,
  approvedVersion,
  canTransitionReview,
  clamp01,
  currentVersion,
  deliverableIsOverdue,
  filterDeliverables,
  filterReviewQueue,
  mapClientToNormalized,
  mapNormalizedToPercent,
  unresolvedCount,
} from '../../../apps/web/src/lib/demo/stage5-deliverables';

describe('stage5 deliverable helpers', () => {
  it('filters needs_review and groups overdue', () => {
    const needs = filterDeliverables(
      DEMO_GRAPH.deliverables,
      { ...EMPTY_DELIVERABLE_FILTERS, group: 'needs_review' },
      'en',
    );
    expect(needs.length).toBeGreaterThan(0);
    expect(
      needs.every((d) => d.reviewStatus === 'AWAITING_REVIEW' || d.reviewStatus === 'IN_REVIEW'),
    ).toBe(true);
    const overdue = DEMO_GRAPH.deliverables.find((d) => d.id === 'demo-deliv-static');
    expect(overdue && deliverableIsOverdue(overdue)).toBe(true);
  });

  it('computes review queue tabs and unresolved counts', () => {
    const waiting = filterReviewQueue(DEMO_GRAPH.deliverables, 'waiting');
    expect(waiting.every((d) => ['AWAITING_REVIEW', 'IN_REVIEW'].includes(d.reviewStatus))).toBe(
      true,
    );
    const carousel = DEMO_GRAPH.deliverables.find((d) => d.id === 'demo-deliv-carousel')!;
    expect(unresolvedCount(carousel)).toBeGreaterThan(0);
  });

  it('maps annotation coordinates and clamps', () => {
    expect(clamp01(1.4)).toBe(1);
    expect(clamp01(-0.2)).toBe(0);
    const norm = mapClientToNormalized(150, 200, { left: 100, top: 100, width: 200, height: 200 });
    expect(norm).toEqual({ x: 0.25, y: 0.5 });
    const pct = mapNormalizedToPercent(0.25, 0.5);
    expect(pct).toEqual({ left: '25%', top: '50%' });
  });

  it('validates review transitions', () => {
    expect(canTransitionReview('AWAITING_REVIEW', 'APPROVED')).toBe(true);
    expect(canTransitionReview('APPROVED', 'CHANGES_REQUESTED')).toBe(false);
    expect(canTransitionReview('CHANGES_REQUESTED', 'DRAFT')).toBe(true);
  });
});

describe('stage5 demo provider review graph', () => {
  it('selects versions, annotates, requests changes, revises, and approves immutably', () => {
    const provider = new DemoDataProvider(structuredClone(DEMO_GRAPH));
    const id = 'demo-deliv-carousel';
    const before = provider.getDeliverable(id)!;
    expect(currentVersion(before)?.id).toBe(before.currentVersionId);

    const annotated = provider.addAnnotation(id, {
      versionId: before.currentVersionId,
      x: 0.42,
      y: 0.33,
      author: 'Layla Haddad',
      body: { en: 'Pin CTA', ar: 'دبوس الدعوة' },
    })!;
    expect(annotated.annotations.some((a) => a.x === 0.42 && a.y === 0.33)).toBe(true);

    const changes = provider.decideReview(id, {
      decision: 'CHANGES_REQUESTED',
      versionId: before.currentVersionId,
      actor: 'Layla Haddad',
      reason: { en: 'Increase CTA contrast', ar: 'زد تباين الدعوة' },
    })!;
    expect(changes.reviewStatus).toBe('CHANGES_REQUESTED');

    const revised = provider.addDemoRevision(id, {
      clientRequestId: 'rev-once',
      createdBy: 'Rami Khalil',
    })!;
    const again = provider.addDemoRevision(id, {
      clientRequestId: 'rev-once',
      createdBy: 'Rami Khalil',
    })!;
    expect(again.versions.length).toBe(revised.versions.length);
    expect(revised.versions.length).toBe(before.versions.length + 1);
    const newVersionId = revised.currentVersionId;
    expect(revised.versions.some((v) => v.id === before.currentVersionId)).toBe(true);

    const submitted = provider.submitForReview(id, newVersionId)!;
    expect(submitted.reviewStatus).toBe('AWAITING_REVIEW');

    const approved = provider.decideReview(id, {
      decision: 'APPROVED',
      versionId: newVersionId,
      actor: 'Layla Haddad',
      reason: { en: 'Ship', ar: 'انشر' },
    })!;
    expect(approved.reviewStatus).toBe('APPROVED');
    expect(approved.approvedVersionId).toBe(newVersionId);
    const locked = approved.versions.find((v) => v.id === newVersionId)!;
    expect(locked.immutable).toBe(true);
    expect(approvedVersion(approved)?.id).toBe(newVersionId);

    expect(() =>
      provider.addAnnotation(id, {
        versionId: newVersionId,
        x: 0.1,
        y: 0.1,
        author: 'Layla Haddad',
        body: { en: 'nope', ar: 'لا' },
      }),
    ).toThrow(/immutable|approved/i);

    expect(() =>
      provider.decideReview(id, {
        decision: 'CHANGES_REQUESTED',
        versionId: newVersionId,
        actor: 'Layla Haddad',
        reason: { en: 'late', ar: 'متأخر' },
      }),
    ).toThrow(/transition|immutable|mutate/i);
  });

  it('creates deliverable from task idempotently', () => {
    const provider = new DemoDataProvider(structuredClone(DEMO_GRAPH));
    const task = provider.getGraph().tasks.find((t) => !t.deliverableId)!;
    const first = provider.createDeliverableFromTask(task.id);
    const second = provider.createDeliverableFromTask(task.id);
    expect(first.id).toBe(second.id);
    expect(provider.getGraph().tasks.find((t) => t.id === task.id)?.deliverableId).toBe(first.id);
  });

  it('preserves approved older version when a newer draft revision exists', () => {
    const multi = DEMO_GRAPH.deliverables.find((d) => d.id === 'demo-deliv-video')!;
    expect(multi.approvedVersionId).toBe('demo-dv-video-v1');
    expect(multi.currentVersionId).toBe('demo-dv-video-v3');
    expect(multi.approvedVersionId).not.toBe(multi.currentVersionId);
    expect(multi.versions.find((v) => v.id === multi.approvedVersionId)?.immutable).toBe(true);
  });
});
