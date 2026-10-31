/** Per-target publish lifecycle (ContentPublishTarget). */
export const TARGET_PUBLISH_STATES = [
  'NONE',
  'QUEUED',
  'PUBLISHING',
  'PUBLISHED',
  'FAILED',
] as const;
export type TargetPublishState = (typeof TARGET_PUBLISH_STATES)[number];

/** Aggregated publish state on ContentItem. */
export const CONTENT_PUBLISH_ROLLUP_STATES = [
  'NONE',
  'IN_PROGRESS',
  'ALL_SUCCEEDED',
  'PARTIAL',
  'FAILED',
] as const;
export type ContentPublishRollupState = (typeof CONTENT_PUBLISH_ROLLUP_STATES)[number];

export function computePublishRollup(
  targetStates: TargetPublishState[],
): ContentPublishRollupState {
  if (!targetStates.length) return 'NONE';
  const published = targetStates.filter((s) => s === 'PUBLISHED').length;
  const failed = targetStates.filter((s) => s === 'FAILED').length;
  const inFlight = targetStates.some((s) => s === 'QUEUED' || s === 'PUBLISHING');
  if (published === targetStates.length) return 'ALL_SUCCEEDED';
  if (failed === targetStates.length) return 'FAILED';
  if (published > 0 && (failed > 0 || inFlight)) return 'PARTIAL';
  if (published > 0 && failed === 0 && !inFlight) return 'ALL_SUCCEEDED';
  if (inFlight || targetStates.some((s) => s === 'QUEUED')) return 'IN_PROGRESS';
  if (failed > 0) return 'FAILED';
  return 'NONE';
}

/** Map rollup to legacy UI publish labels where needed. */
export function rollupToLegacyPublishState(rollup: ContentPublishRollupState): string {
  switch (rollup) {
    case 'ALL_SUCCEEDED':
      return 'PUBLISHED';
    case 'IN_PROGRESS':
      return 'QUEUED';
    case 'PARTIAL':
      return 'PARTIAL';
    case 'FAILED':
      return 'FAILED';
    default:
      return 'NONE';
  }
}
