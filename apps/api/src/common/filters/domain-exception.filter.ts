import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { DomainError, errorEnvelope } from '@oma/domain';
import { createCorrelationId } from '@oma/observability';
import type { Request, Response } from 'express';

@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const correlationId =
      req.oma?.correlationId ?? createCorrelationId(req.header('x-correlation-id'));
    const requestId = req.oma?.requestId ?? createCorrelationId();

    if (exception instanceof DomainError) {
      res.status(exception.status).json(errorEnvelope(exception, correlationId, requestId));
      return;
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === 'string'
          ? body
          : ((body as { message?: string }).message ?? exception.message);
      res
        .status(status)
        .json(
          errorEnvelope(
            new DomainError('VALIDATION_FAILED', String(message), status, 'errors.http'),
            correlationId,
            requestId,
          ),
        );
      return;
    }
    console.error(exception);
    res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json(
        errorEnvelope(
          new DomainError('VALIDATION_FAILED', 'Internal server error', 500, 'errors.internal'),
          correlationId,
          requestId,
        ),
      );
  }
}
