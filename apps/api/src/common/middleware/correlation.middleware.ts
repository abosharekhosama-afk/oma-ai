import { Injectable, NestMiddleware } from '@nestjs/common';
import { createCorrelationId } from '@oma/observability';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const correlationId = createCorrelationId(req.header('x-correlation-id'));
    const requestId = createCorrelationId();
    req.oma = { correlationId, requestId, capabilities: [] };
    res.setHeader('X-Correlation-Id', correlationId);
    res.setHeader('X-Request-Id', requestId);
    next();
  }
}
