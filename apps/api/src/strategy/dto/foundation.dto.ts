/** Logical foundation document shape for Feature 003 (planning labels only). */
export type FoundationDocument = {
  goals?: Array<{ value: string; infoClass: string }>;
  positioning?: { value: string; infoClass: string } | string;
  keyMessages?: Array<{ value: string; infoClass: string }>;
  constraints?: Array<{ value: string; infoClass: string }>;
  marketLocale?: { value: string; infoClass: string } | string;
  sharedCampaignObjectives?: unknown[];
  funnelStages?: unknown[];
  recommendedFormats?: unknown[];
  cadence?: unknown;
  timeHorizon?: unknown;
  sharedChannels?: unknown[];
  contentPillars?: unknown[];
  notesInternal?: string;
};

export function isFoundationDocument(value: unknown): value is FoundationDocument {
  return typeof value === 'object' && value !== null;
}
