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
    }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

export {};
