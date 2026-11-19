/** Stable BullMQ job id for ingestion scan jobs (must match worker outbox publisher). */
export function bullIngestionJobId(jobRunId: string): string {
  return `ingestion-${jobRunId}`;
}

export function bullAnalysisJobId(jobRunId: string): string {
  return `analysis-${jobRunId}`;
}
