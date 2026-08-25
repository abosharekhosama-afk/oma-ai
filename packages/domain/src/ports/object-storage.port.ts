export interface ObjectStoragePort {
  putObject(input: {
    tenantId: string;
    key: string;
    bytes: Uint8Array;
    contentType: string;
  }): Promise<{ externalRef: string; checksum: string }>;
  getObject(input: { tenantId: string; externalRef: string }): Promise<Uint8Array>;
  headObject(input: {
    tenantId: string;
    externalRef: string;
  }): Promise<{ contentType: string; size: number }>;
  deleteObject(input: { tenantId: string; externalRef: string }): Promise<void>;
}

export class ObjectStorageNotConfiguredError extends Error {
  constructor() {
    super('Object storage backend is not configured (DEC-003 open)');
    this.name = 'ObjectStorageNotConfiguredError';
  }
}
