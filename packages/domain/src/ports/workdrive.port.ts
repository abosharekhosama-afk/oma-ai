export interface WorkDrivePort {
  mapFolder(input: { tenantId: string; contextPath: string }): Promise<{ folderRef: string }>;
  syncApproved(input: {
    tenantId: string;
    fileObjectRefId: string;
  }): Promise<{ externalRef: string }>;
  reconcile(input: { tenantId: string; externalRef: string }): Promise<{ status: string }>;
}

export class WorkDriveNotConfiguredError extends Error {
  constructor() {
    super('WorkDrive connector is not configured (DEC-003 open)');
    this.name = 'WorkDriveNotConfiguredError';
  }
}
