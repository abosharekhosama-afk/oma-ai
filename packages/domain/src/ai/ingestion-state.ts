import { isAiAnalysisAvailable, type AiRuntimeEnv } from './availability';

/** Profile/scan `aiAvailability` right after extraction — before the analysis worker runs. */
export function brandAiAvailabilityAfterScanComplete(
  env: AiRuntimeEnv = process.env,
): 'NOT_CONFIGURED' | 'SKIPPED' {
  return isAiAnalysisAvailable(env) ? 'SKIPPED' : 'NOT_CONFIGURED';
}

export function scanAnalysisAutoEnqueueExpected(env: AiRuntimeEnv = process.env): boolean {
  return isAiAnalysisAvailable(env);
}
