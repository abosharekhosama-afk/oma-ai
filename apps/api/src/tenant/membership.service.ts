import { Injectable } from '@nestjs/common';
import { TenantService } from './tenant.service';

/** Membership lifecycle commands — delegates to TenantService authoritative writer. */
@Injectable()
export class MembershipService {
  constructor(private readonly tenants: TenantService) {}

  invite(actorUserId: string, tenantId: string, email: string) {
    return this.tenants.invite(actorUserId, tenantId, email);
  }

  accept(userId: string, token: string) {
    return this.tenants.acceptInvite(userId, token);
  }

  suspend(actorUserId: string, tenantId: string, membershipId: string) {
    return this.tenants.suspendMembership(actorUserId, tenantId, membershipId);
  }

  remove(actorUserId: string, tenantId: string, membershipId: string) {
    return this.tenants.removeMembership(actorUserId, tenantId, membershipId);
  }
}
