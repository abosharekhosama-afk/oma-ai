import { AuditService } from './audit/audit.service';
import { IdentityService } from './identity/identity.service';
import { TenantService } from './tenant/tenant.service';

export const auditService = new AuditService();
export const identityService = new IdentityService(auditService);
export const tenantService = new TenantService(auditService);
