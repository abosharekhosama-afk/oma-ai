export interface PaidMediaConnectorPort {
  listAccounts(tenantId: string): Promise<Array<{ id: string; name: string }>>;
  createDraft(input: { tenantId: string; intentId: string }): Promise<{ externalDraftId: string }>;
  activate(input: { tenantId: string; externalDraftId: string }): Promise<{ status: string }>;
  reconcileWebhook(input: { payload: unknown; signature: string }): Promise<void>;
}

export class PaidMediaNotConfiguredError extends Error {
  constructor() {
    super('Paid-media connector is not configured (DEC-006 open)');
    this.name = 'PaidMediaNotConfiguredError';
  }
}
