import { describe, expect, it } from 'vitest';
import {
  buildAnalysisJobData,
  bullAnalysisJobId,
} from '../../apps/worker/src/processors/analysis-job-payload';

describe('analysis outbox payload', () => {
  it('builds a tenant-scoped analysis job payload', () => {
    const data = buildAnalysisJobData({
      jobRunId: 'job-1',
      outboxId: 'out-1',
      tenantId: 't1',
      brandId: 'b1',
      scanAttemptId: 's1',
      profileVersionId: 'p1',
      actorUserId: 'u1',
      correlationId: 'c1',
      idempotencyKey: 'analysis:s1:p1',
    });
    expect(data.job_run_id).toBe('job-1');
    expect(data.tenant_id).toBe('t1');
    expect(data.scan_attempt_id).toBe('s1');
    expect(data.profile_version_id).toBe('p1');
    expect(bullAnalysisJobId('job-1')).toBe('analysis-job-1');
  });
});
