import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../common/guards/auth.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { CapabilitiesGuard } from '../common/guards/capabilities.guard';
import { DomainError } from '@oma/domain';
import { opsService } from '../container';

@Controller()
@UseGuards(AuthGuard, CapabilitiesGuard)
export class OpsController {
  private requireTenant(req: Request) {
    if (!req.oma?.tenantId) {
      throw new DomainError('TENANT_REQUIRED', 'Tenant required', 403, 'errors.tenant_required');
    }
  }

  @Get('api/v1/brands/:brandId/requests')
  async listRequests(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
  ) {
    this.requireTenant(req);
    return opsService.listRequests(req.oma!.tenantId!, brandId, { status, q });
  }

  @Post('api/v1/brands/:brandId/requests')
  @UseGuards(CsrfGuard)
  async createRequest(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Body() body: Record<string, unknown>,
  ) {
    this.requireTenant(req);
    return opsService.createRequest(
      req.oma!.tenantId!,
      req.oma!.userId!,
      brandId,
      body as never,
      req.oma!.correlationId,
    );
  }

  @Get('api/v1/requests/:requestId')
  async getRequest(@Req() req: Request, @Param('requestId') requestId: string) {
    this.requireTenant(req);
    return opsService.getRequest(req.oma!.tenantId!, requestId);
  }

  @Patch('api/v1/requests/:requestId')
  @UseGuards(CsrfGuard)
  async updateRequest(
    @Req() req: Request,
    @Param('requestId') requestId: string,
    @Body() body: Record<string, unknown>,
  ) {
    this.requireTenant(req);
    return opsService.updateRequest(
      req.oma!.tenantId!,
      req.oma!.userId!,
      requestId,
      body,
      req.oma!.correlationId,
    );
  }

  @Post('api/v1/requests/:requestId/convert-to-task')
  @UseGuards(CsrfGuard)
  async convertToTask(@Req() req: Request, @Param('requestId') requestId: string) {
    this.requireTenant(req);
    return opsService.convertRequestToTask(
      req.oma!.tenantId!,
      req.oma!.userId!,
      requestId,
      req.oma!.correlationId,
    );
  }

  @Get('api/v1/brands/:brandId/tasks')
  async listTasks(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Query('status') status?: string,
  ) {
    this.requireTenant(req);
    return opsService.listTasks(req.oma!.tenantId!, brandId, { status });
  }

  @Post('api/v1/brands/:brandId/tasks')
  @UseGuards(CsrfGuard)
  async createTask(
    @Req() req: Request,
    @Param('brandId') brandId: string,
    @Body() body: Record<string, unknown>,
  ) {
    this.requireTenant(req);
    return opsService.createTask(
      req.oma!.tenantId!,
      req.oma!.userId!,
      brandId,
      body as never,
      req.oma!.correlationId,
    );
  }

  @Patch('api/v1/tasks/:taskId')
  @UseGuards(CsrfGuard)
  async updateTask(
    @Req() req: Request,
    @Param('taskId') taskId: string,
    @Body() body: Record<string, unknown>,
  ) {
    this.requireTenant(req);
    return opsService.updateTask(
      req.oma!.tenantId!,
      req.oma!.userId!,
      taskId,
      body,
      req.oma!.correlationId,
    );
  }

  @Post('api/v1/tasks/:taskId/convert-to-deliverable')
  @UseGuards(CsrfGuard)
  async convertToDeliverable(@Req() req: Request, @Param('taskId') taskId: string) {
    this.requireTenant(req);
    return opsService.convertTaskToDeliverable(
      req.oma!.tenantId!,
      req.oma!.userId!,
      taskId,
      req.oma!.correlationId,
    );
  }

  @Get('api/v1/brands/:brandId/deliverables')
  async listDeliverables(@Req() req: Request, @Param('brandId') brandId: string) {
    this.requireTenant(req);
    return opsService.listDeliverables(req.oma!.tenantId!, brandId);
  }

  
  @Get('api/v1/deliverables/:deliverableId')
  async getDeliverable(@Req() req: Request, @Param('deliverableId') deliverableId: string) {
    this.requireTenant(req);
    return opsService.getDeliverable(req.oma!.tenantId!, deliverableId);
  }

  @Patch('api/v1/deliverables/:deliverableId')
  @UseGuards(CsrfGuard)
  async updateDeliverable(
    @Req() req: Request,
    @Param('deliverableId') deliverableId: string,
    @Body() body: Record<string, unknown>,
  ) {
    this.requireTenant(req);
    return opsService.updateDeliverable(
      req.oma!.tenantId!,
      req.oma!.userId!,
      deliverableId,
      body,
      req.oma!.correlationId,
    );
  }

  @Post('api/v1/deliverables/:deliverableId/review')
  @UseGuards(CsrfGuard)
  async reviewDeliverable(
    @Req() req: Request,
    @Param('deliverableId') deliverableId: string,
    @Body() body: { action?: string },
  ) {
    this.requireTenant(req);
    return opsService.reviewDeliverable(
      req.oma!.tenantId!,
      req.oma!.userId!,
      deliverableId,
      String(body?.action || ''),
      req.oma!.correlationId,
    );
  }
}
