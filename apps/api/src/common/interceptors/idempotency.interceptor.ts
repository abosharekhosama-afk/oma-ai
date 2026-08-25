import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { DomainError, newId } from '@oma/domain';
import { getPrisma } from '@oma/db';
import { createHash } from 'node:crypto';
import { Observable, from, of, switchMap } from 'rxjs';
import type { Request, Response } from 'express';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const key = req.header('idempotency-key');
    if (!key || !['POST', 'PUT', 'PATCH'].includes(req.method)) return next.handle();
    if (!req.oma?.userId || !req.oma.tenantId) return next.handle();

    const requestHash = createHash('sha256')
      .update(`${req.method}:${req.path}:${JSON.stringify(req.body ?? {})}`)
      .digest('hex');
    const prisma = getPrisma();

    return from(
      prisma.idempotencyRecord.findUnique({
        where: {
          tenantId_actorUserId_key: {
            tenantId: req.oma.tenantId,
            actorUserId: req.oma.userId,
            key,
          },
        },
      }),
    ).pipe(
      switchMap((existing) => {
        if (existing) {
          if (existing.requestHash !== requestHash) {
            throw new DomainError(
              'IDEMPOTENCY_KEY_REUSE',
              'Idempotency key reuse with different body',
              409,
              'errors.idempotency',
            );
          }
          res.status(existing.responseStatus);
          return of(JSON.parse(existing.responseBody));
        }
        return next.handle().pipe(
          switchMap(async (body) => {
            const status = res.statusCode || 200;
            await prisma.idempotencyRecord.create({
              data: {
                id: newId(),
                tenantId: req.oma!.tenantId!,
                actorUserId: req.oma!.userId!,
                key,
                requestHash,
                responseStatus: status,
                responseBody: JSON.stringify(body ?? null),
                expiresAt: new Date(Date.now() + 24 * 3600_000),
              },
            });
            return body;
          }),
        );
      }),
    );
  }
}
