import { PrismaClient } from '@prisma/client';
import { scopeArgs } from './brand-scope';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const base = new PrismaClient();
  // Brand access is enforced for every query made inside a request's brand scope.
  return base.$extends({
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          return query(scopeArgs(model, operation, args as Record<string, unknown>) as never);
        },
      },
    },
  }) as unknown as PrismaClient;
}

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient();
  }
  return globalForPrisma.prisma;
}

export class PrismaService {
  client = getPrisma();
}
