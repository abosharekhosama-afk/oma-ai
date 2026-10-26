import { Injectable, NestMiddleware } from '@nestjs/common';
import { runWithBrandScope } from '@oma/db';
import type { NextFunction, Request, Response } from 'express';

/** Opens a per-request brand scope; AuthGuard narrows it once the user is known. */
@Injectable()
export class BrandScopeMiddleware implements NestMiddleware {
  use(_req: Request, _res: Response, next: NextFunction) {
    runWithBrandScope({ allowed: null }, () => next());
  }
}
