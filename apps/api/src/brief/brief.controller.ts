import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { DomainError } from '@oma/domain';
import { AuthGuard } from '../common/guards/auth.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { CapabilitiesGuard } from '../common/guards/capabilities.guard';
import { briefService } from '../container';

type Body_ = Record<string, unknown>;

/** Brief aggregate routes (DEC-019). Capabilities are mapped in capabilities.guard.ts. */
@Controller('api/v1/brands/:brandId/briefs')
@UseGuards(AuthGuard, CapabilitiesGuard)
export class BriefController {
  private actor(req: Request) {
    if (!req.oma?.tenantId || !req.oma.userId) {
      throw new DomainError(
        'TENANT_REQUIRED',
        'Active tenant required',
        400,
        'errors.tenant_required',
      );
    }
    return {
      tenantId: req.oma.tenantId,
      userId: req.oma.userId,
      correlationId: req.oma.correlationId,
    };
  }

  @Get()
  list(@Req() req: Request, @Param('brandId') brandId: string, @Query('status') status?: string) {
    return briefService.list(this.actor(req).tenantId, brandId, { status });
  }

  @Post()
  @UseGuards(CsrfGuard)
  create(@Req() req: Request, @Param('brandId') brandId: string, @Body() body: Body_) {
    return briefService.create(this.actor(req), brandId, body);
  }

  @Post('from-strategy')
  @UseGuards(CsrfGuard)
  fromStrategy(@Req() req: Request, @Param('brandId') brandId: string, @Body() body: Body_) {
    return briefService.createFromStrategy(this.actor(req), brandId, body);
  }

  @Get(':briefId')
  get(@Req() req: Request, @Param('brandId') brandId: string, @Param('briefId') briefId: string) {
    return briefService.get(this.actor(req).tenantId, brandId, briefId);
  }

  @Patch(':briefId')
  @UseGuards(CsrfGuard)
  update(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('briefId') briefId: string,
    @Body() body: Body_,
  ) {
    return briefService.update(this.actor(req), brandId, briefId, body);
  }

  @Post(':briefId/submit')
  @UseGuards(CsrfGuard)
  submit(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('briefId') briefId: string,
    @Body() body: Body_,
  ) {
    return briefService.submit(this.actor(req), brandId, briefId, body);
  }

  @Post(':briefId/approve')
  @UseGuards(CsrfGuard)
  approve(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('briefId') briefId: string,
    @Body() body: Body_,
  ) {
    return briefService.approve(this.actor(req), brandId, briefId, body);
  }

  @Post(':briefId/request-changes')
  @UseGuards(CsrfGuard)
  requestChanges(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('briefId') briefId: string,
    @Body() body: Body_,
  ) {
    return briefService.requestChanges(this.actor(req), brandId, briefId, body);
  }

  @Post(':briefId/revise')
  @UseGuards(CsrfGuard)
  revise(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('briefId') briefId: string,
    @Body() body: Body_,
  ) {
    return briefService.revise(this.actor(req), brandId, briefId, body);
  }

  @Post(':briefId/cancel')
  @UseGuards(CsrfGuard)
  cancel(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('briefId') briefId: string,
    @Body() body: Body_,
  ) {
    return briefService.cancel(this.actor(req), brandId, briefId, body);
  }

  @Post(':briefId/convert')
  @UseGuards(CsrfGuard)
  convert(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('briefId') briefId: string,
    @Body() body: Body_,
  ) {
    return briefService.convert(this.actor(req), brandId, briefId, body);
  }

  @Post(':briefId/comments')
  @UseGuards(CsrfGuard)
  comment(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Param('briefId') briefId: string,
    @Body() body: Body_,
  ) {
    return briefService.comment(this.actor(req), brandId, briefId, body);
  }
}
