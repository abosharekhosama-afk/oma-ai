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
  requestUpload(input: {
    tenantId: string;
    key: string;
    contentType: string;
    size: number;
    sha256: string;
  }): Promise<{ uploadUrl: string; uploadId: string; fileId: string; name: string }>;
  signedReadUrl(input: {
    tenantId: string;
    externalRef: string;
    mode: 'preview' | 'download';
  }): Promise<{ url: string; expiresAt: Date }>;
}

export class ObjectStorageNotConfiguredError extends Error {
  constructor() {
    super('Object storage backend is not configured (DEC-003 open)');
    this.name = 'ObjectStorageNotConfiguredError';
  }
}
