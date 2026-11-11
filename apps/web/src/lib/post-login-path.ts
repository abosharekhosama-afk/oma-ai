import { api } from './api';
import { canAccessAdminHub } from './platform-operator';

type MeResponse = {
  user?: { system_role?: string };
  capabilities?: string[];
};

/** Operators land on the admin hub instead of the tenant workspace when no deep link was requested. */
export async function resolvePostLoginPath(next: string): Promise<string> {
  const path = next?.trim() || '/app';
  const generic = path === '/app' || path === '/app/' || path.startsWith('/app/select-company');
  if (!generic) return path;
  try {
    const me = await api<MeResponse>('/api/v1/auth/me');
    const access = canAccessAdminHub({
      systemRole: me.user?.system_role,
      capabilities: me.capabilities,
    });
    if (access.ok) return '/app/admin';
  } catch {
    /* keep client path */
  }
  return path;
}
