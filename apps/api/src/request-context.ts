export type RequestContext = {
  correlationId: string;
  requestId: string;
  userId?: string;
  tenantId?: string;
  capabilities: string[];
  membershipId?: string;
};

// Express request augmentation for server-authoritative OMA context.
/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace Express {
    interface Request {
      oma?: RequestContext;
      /** Per-brand access resolved by AuthGuard (see brand/brand-access.ts). */
      brandAccess?: import('./brand/brand-access').BrandAccess;
    }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

export {};
