export interface RetentionPolicyPort {
  resolveRetentionDays(input: { tenantId: string; dataClass: string }): Promise<number | null>;
}

export class RetentionPolicyNotConfiguredError extends Error {
  constructor() {
    super('Retention policy is not configured (DEC-012 open)');
    this.name = 'RetentionPolicyNotConfiguredError';
  }
}
