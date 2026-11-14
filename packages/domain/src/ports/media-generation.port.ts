export type MediaGenerationPurpose = 'catalog_product_reel' | 'catalog_product_short';

export type MediaGenerationRequest = {
  tenantId: string;
  purpose: MediaGenerationPurpose;
  sourceImageBytes: Buffer;
  sourceMime: string;
  /** Target duration in seconds (reel ~15–30, short ~6–10). */
  durationSeconds: number;
};

export type MediaGenerationResult = {
  outputBytes: Buffer;
  mime: string;
  providerCode: string;
  /** Always a human-review proposal — not client-ready final delivery. */
  proposal: true;
  unknowns: string[];
};

export interface MediaGenerationPort {
  generateProductMotion(request: MediaGenerationRequest): Promise<MediaGenerationResult>;
}

export class MediaGenerationNotConfiguredError extends Error {
  constructor(message = 'Media generation provider is not configured') {
    super(message);
    this.name = 'MediaGenerationNotConfiguredError';
  }
}
