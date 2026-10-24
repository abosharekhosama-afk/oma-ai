import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  assertDemoModeAllowed,
  demoDataProvider,
  isDemoModeEnabled,
  type DemoCampaignInput,
  type DemoCampaignPatch,
  type DemoContentInput,
  type DemoContentPatch,
  type DemoLocaleCopy,
  type DemoPreferences,
  type DemoScheduleState,
} from '@oma/demo';
import { AuthGuard } from '../common/guards/auth.guard';
import { loadEnv } from '@oma/config';

function asCopy(value: unknown, field: string): DemoLocaleCopy {
  if (
    value &&
    typeof value === 'object' &&
    typeof (value as DemoLocaleCopy).en === 'string' &&
    typeof (value as DemoLocaleCopy).ar === 'string'
  ) {
    return value as DemoLocaleCopy;
  }
  if (typeof value === 'string' && value.trim()) {
    return { en: value.trim(), ar: value.trim() };
  }
  throw new BadRequestException(`${field} is required`);
}

@Controller('api/v1/demo')
@UseGuards(AuthGuard)
export class DemoController {
  @Get('status')
  status() {
    const env = loadEnv();
    return {
      data: {
        enabled: isDemoModeEnabled({
          NODE_ENV: env.NODE_ENV,
          OMA_DEMO_MODE: env.OMA_DEMO_MODE ? '1' : '0',
          OMA_DEMO_ALLOW_PRODUCTION: env.OMA_DEMO_ALLOW_PRODUCTION ? '1' : '0',
        }),
        label: demoDataProvider.getGraph().meta.label,
        production_blocked: env.NODE_ENV === 'production' && !env.OMA_DEMO_ALLOW_PRODUCTION,
      },
    };
  }

  @Get('graph')
  graph(@Res({ passthrough: true }) res: Response) {
    this.requireDemo();
    res.setHeader('x-oma-demo-data', '1');
    return { data: demoDataProvider.getGraph() };
  }

  @Post('reset')
  reset(@Res({ passthrough: true }) res: Response) {
    this.requireDemo();
    res.setHeader('x-oma-demo-data', '1');
    return { data: demoDataProvider.reset() };
  }

  @Get('journey')
  journey(@Res({ passthrough: true }) res: Response) {
    this.requireDemo();
    res.setHeader('x-oma-demo-data', '1');
    return { data: demoDataProvider.getLinkedJourney() };
  }

  @Get('campaigns')
  campaigns() {
    this.requireDemo();
    return { data: demoDataProvider.getGraph().campaigns };
  }

  @Post('campaigns')
  createCampaign(@Body() body: Record<string, unknown>) {
    this.requireDemo();
    try {
      const input: DemoCampaignInput = {
        name: asCopy(body.name, 'name'),
        goal: body.goal ? asCopy(body.goal, 'goal') : undefined,
        strategyId: String(body.strategyId ?? ''),
        brandId: String(body.brandId ?? ''),
        track: body.track === 'PAID' ? 'PAID' : 'ORGANIC',
        owner: String(body.owner ?? '').trim(),
        timeline: {
          start: String(
            (body.timeline as { start?: string } | undefined)?.start ?? body.start ?? '',
          ),
          end: String((body.timeline as { end?: string } | undefined)?.end ?? body.end ?? ''),
        },
        channels: Array.isArray(body.channels)
          ? body.channels.map(String)
          : String(body.channels ?? '')
              .split(',')
              .map((c) => c.trim())
              .filter(Boolean),
        links: Array.isArray(body.links) ? body.links.map(String).filter(Boolean) : [],
        status:
          typeof body.status === 'string' ? (body.status as DemoCampaignInput['status']) : 'DRAFT',
        audience: body.audience ? asCopy(body.audience, 'audience') : undefined,
      };
      if (!input.strategyId || !input.owner || !input.timeline.start || !input.timeline.end) {
        throw new BadRequestException('strategyId, owner, and date range are required');
      }
      if (!input.channels.length) {
        throw new BadRequestException('At least one channel is required');
      }
      const row = demoDataProvider.createCampaign(input);
      return { data: row };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(err instanceof Error ? err.message : 'Invalid campaign');
    }
  }

  @Get('campaigns/:id')
  campaign(@Param('id') id: string) {
    this.requireDemo();
    const row = demoDataProvider.getCampaign(id);
    if (!row) throw new NotFoundException('Not found');
    return { data: row };
  }

  @Patch('campaigns/:id')
  updateCampaign(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    this.requireDemo();
    try {
      const patch: DemoCampaignPatch = {};
      if (body.name !== undefined) patch.name = asCopy(body.name, 'name');
      if (body.goal !== undefined) patch.goal = asCopy(body.goal, 'goal');
      if (body.audience !== undefined) patch.audience = asCopy(body.audience, 'audience');
      if (typeof body.strategyId === 'string') patch.strategyId = body.strategyId;
      if (typeof body.brandId === 'string') patch.brandId = body.brandId;
      if (body.track === 'ORGANIC' || body.track === 'PAID') patch.track = body.track;
      if (typeof body.owner === 'string') patch.owner = body.owner.trim();
      if (typeof body.status === 'string') {
        patch.status = body.status as DemoCampaignInput['status'];
      }
      if (body.timeline && typeof body.timeline === 'object') {
        const timeline = body.timeline as { start?: unknown; end?: unknown };
        if (typeof timeline.start === 'string' && typeof timeline.end === 'string') {
          patch.timeline = { start: timeline.start, end: timeline.end };
        }
      }
      if (Array.isArray(body.channels)) patch.channels = body.channels.map(String);
      else if (typeof body.channels === 'string') {
        patch.channels = body.channels
          .split(',')
          .map((channel) => channel.trim())
          .filter(Boolean);
      }
      if (Array.isArray(body.links)) patch.links = body.links.map(String).filter(Boolean);
      const row = demoDataProvider.updateCampaign(id, patch);
      if (!row) throw new NotFoundException('Not found');
      return { data: row };
    } catch (err) {
      if (err instanceof NotFoundException || err instanceof BadRequestException) throw err;
      throw new BadRequestException(err instanceof Error ? err.message : 'Invalid campaign');
    }
  }

  @Get('content')
  content() {
    this.requireDemo();
    return { data: demoDataProvider.getGraph().contentItems };
  }

  @Get('content/:id')
  contentItem(@Param('id') id: string) {
    this.requireDemo();
    const row = demoDataProvider.getContent(id);
    if (!row) throw new NotFoundException('Not found');
    return { data: row };
  }

  @Post('content')
  createContent(@Body() body: Record<string, unknown>) {
    this.requireDemo();
    try {
      const contentType = String(body.contentType ?? 'POST') as DemoContentInput['contentType'];
      const input: DemoContentInput = {
        title: asCopy(body.title, 'title'),
        campaignId: String(body.campaignId ?? ''),
        brandId: String(body.brandId ?? ''),
        track: body.track === 'PAID' ? 'PAID' : 'ORGANIC',
        channel: String(body.channel ?? '').trim(),
        contentType: ['REEL', 'CAROUSEL', 'STATIC', 'STORY', 'POST'].includes(contentType)
          ? contentType
          : 'POST',
        owner: String(body.owner ?? body.assignee ?? '').trim(),
        scheduledAt:
          body.scheduledAt === null || body.scheduledAt === undefined || body.scheduledAt === ''
            ? null
            : String(body.scheduledAt),
        status:
          typeof body.status === 'string' ? (body.status as DemoContentInput['status']) : 'DRAFT',
        caption: body.caption ? asCopy(body.caption, 'caption') : undefined,
        objective: body.objective ? asCopy(body.objective, 'objective') : undefined,
        cta: body.cta ? asCopy(body.cta, 'cta') : undefined,
        previewAsset:
          typeof body.previewAsset === 'string' && body.previewAsset.startsWith('/demo/')
            ? body.previewAsset
            : undefined,
      };
      if (!input.campaignId || !input.channel || !input.owner) {
        throw new BadRequestException('campaignId, channel, and owner are required');
      }
      const row = demoDataProvider.createContent(input);
      return { data: row };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(err instanceof Error ? err.message : 'Invalid content');
    }
  }

  @Patch('content/:id')
  updateContent(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    this.requireDemo();
    if (body.command === 'schedule') {
      const result = demoDataProvider.scheduleContent(id);
      if ('error' in result) {
        throw new BadRequestException(result.error);
      }
      return { data: result.row };
    }
    if (body.command === 'unschedule') {
      const row = demoDataProvider.unscheduleContent(id);
      if (!row) throw new NotFoundException('Not found');
      return { data: row };
    }
    if (body.command === 'request-approval') {
      const result = demoDataProvider.requestContentApproval(id);
      if ('error' in result) throw new BadRequestException(result.error);
      return { data: result.row };
    }
    if (body.command === 'save-draft') {
      const patch: DemoContentPatch = {};
      if (body.caption !== undefined) patch.caption = asCopy(body.caption, 'caption');
      if (body.objective !== undefined) patch.objective = asCopy(body.objective, 'objective');
      if (body.cta !== undefined) patch.cta = asCopy(body.cta, 'cta');
      if (typeof body.assignee === 'string') patch.assignee = body.assignee;
      if (typeof body.channel === 'string') patch.channel = body.channel;
      if (body.plannedAt !== undefined || body.scheduledAt !== undefined) {
        const raw = body.plannedAt !== undefined ? body.plannedAt : body.scheduledAt;
        patch.plannedAt = raw === null || raw === '' ? null : String(raw);
      }
      const row = demoDataProvider.saveContentDraft(id, patch);
      if (!row) throw new NotFoundException('Not found');
      return { data: row };
    }
    const patch: DemoContentPatch = {};
    if (body.title !== undefined) patch.title = asCopy(body.title, 'title');
    if (body.caption !== undefined) patch.caption = asCopy(body.caption, 'caption');
    if (body.objective !== undefined) patch.objective = asCopy(body.objective, 'objective');
    if (body.cta !== undefined) patch.cta = asCopy(body.cta, 'cta');
    if (typeof body.status === 'string') patch.status = body.status as DemoContentPatch['status'];
    if (body.scheduledAt !== undefined) {
      patch.scheduledAt =
        body.scheduledAt === null || body.scheduledAt === '' ? null : String(body.scheduledAt);
    }
    if (typeof body.assignee === 'string') patch.assignee = body.assignee;
    if (typeof body.channel === 'string') patch.channel = body.channel;
    const row = demoDataProvider.updateContent(id, patch);
    if (!row) throw new NotFoundException('Not found');
    return { data: row };
  }

  @Get('requests')
  requests() {
    this.requireDemo();
    return { data: demoDataProvider.getGraph().requests };
  }

  @Post('requests')
  createRequest(@Body() body: Record<string, unknown>) {
    this.requireDemo();
    try {
      if (
        !String(body.brandId ?? '').trim() ||
        !String(body.dueAt ?? '').trim() ||
        !String(body.requester ?? '').trim()
      ) {
        throw new BadRequestException('brandId, dueAt, and requester are required');
      }
      const type = String(body.type ?? 'OTHER').toUpperCase();
      const allowed = [
        'CONTENT',
        'DESIGN',
        'VIDEO',
        'CAMPAIGN_SUPPORT',
        'REVISION',
        'OTHER',
      ] as const;
      const row = demoDataProvider.createRequest({
        title: asCopy(body.title, 'title'),
        description: body.description ? asCopy(body.description, 'description') : undefined,
        type: (allowed as readonly string[]).includes(type)
          ? (type as (typeof allowed)[number])
          : 'OTHER',
        brandId: String(body.brandId ?? ''),
        campaignId: body.campaignId ? String(body.campaignId) : null,
        contentId: body.contentId ? String(body.contentId) : null,
        priority: (['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(String(body.priority))
          ? String(body.priority)
          : 'MEDIUM') as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
        dueAt: String(body.dueAt ?? ''),
        requester: String(body.requester ?? '').trim(),
        assignee: body.assignee ? String(body.assignee) : null,
        channels: Array.isArray(body.channels) ? body.channels.map(String) : [],
        formats: Array.isArray(body.formats) ? body.formats.map(String) : [],
        outcome: body.outcome ? asCopy(body.outcome, 'outcome') : undefined,
      });
      return { data: row };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(err instanceof Error ? err.message : 'Invalid request');
    }
  }

  @Get('requests/:id')
  request(@Param('id') id: string) {
    this.requireDemo();
    const row = demoDataProvider.getRequest(id);
    if (!row) throw new NotFoundException('Not found');
    const brief = demoDataProvider.getGraph().briefs.find((b) => b.requestId === id) ?? null;
    const tasks = demoDataProvider
      .getGraph()
      .tasks.filter((t) => t.requestId === id || (row.conversionTaskIds ?? []).includes(t.id));
    return { data: { ...row, brief, tasks } };
  }

  @Patch('requests/:id')
  updateRequest(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    this.requireDemo();
    const patch: Parameters<typeof demoDataProvider.updateRequest>[1] = {};
    if (body.title !== undefined) patch.title = asCopy(body.title, 'title');
    if (body.description !== undefined) patch.description = asCopy(body.description, 'description');
    if (typeof body.status === 'string') {
      patch.status = body.status as NonNullable<typeof patch.status>;
    }
    if (typeof body.priority === 'string') {
      patch.priority = body.priority as NonNullable<typeof patch.priority>;
    }
    if (body.assignee !== undefined) {
      patch.assignee =
        body.assignee === null || body.assignee === '' ? null : String(body.assignee);
    }
    if (typeof body.dueAt === 'string') patch.dueAt = body.dueAt;
    if (body.campaignId !== undefined) {
      patch.campaignId =
        body.campaignId === null || body.campaignId === '' ? null : String(body.campaignId);
    }
    if (body.contentId !== undefined) {
      patch.contentId =
        body.contentId === null || body.contentId === '' ? null : String(body.contentId);
    }
    const row = demoDataProvider.updateRequest(id, patch);
    if (!row) throw new NotFoundException('Not found');
    return { data: row };
  }

  @Post('requests/:id/brief')
  upsertBrief(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    this.requireDemo();
    try {
      const asList = (v: unknown) =>
        Array.isArray(v)
          ? v.map((item) => (typeof item === 'string' ? item : asCopy(item, 'item')))
          : [];
      const row = demoDataProvider.upsertBrief(id, {
        overview: body.overview !== undefined ? asCopy(body.overview, 'overview') : undefined,
        objective: body.objective !== undefined ? asCopy(body.objective, 'objective') : undefined,
        audience: body.audience !== undefined ? asCopy(body.audience, 'audience') : undefined,
        keyMessage:
          body.keyMessage !== undefined ? asCopy(body.keyMessage, 'keyMessage') : undefined,
        deliverableType:
          body.deliverableType !== undefined
            ? asCopy(body.deliverableType, 'deliverableType')
            : undefined,
        channels: Array.isArray(body.channels) ? body.channels.map(String) : undefined,
        formats: Array.isArray(body.formats) ? body.formats.map(String) : undefined,
        tone: body.tone !== undefined ? asCopy(body.tone, 'tone') : undefined,
        mandatory: body.mandatory !== undefined ? asCopy(body.mandatory, 'mandatory') : undefined,
        cta: body.cta !== undefined ? asCopy(body.cta, 'cta') : undefined,
        references: Array.isArray(body.references) ? body.references.map(String) : undefined,
        doList: body.doList !== undefined ? (asList(body.doList) as DemoLocaleCopy[]) : undefined,
        dontList:
          body.dontList !== undefined ? (asList(body.dontList) as DemoLocaleCopy[]) : undefined,
        timelineNote:
          body.timelineNote !== undefined ? asCopy(body.timelineNote, 'timelineNote') : undefined,
        stakeholders: Array.isArray(body.stakeholders) ? body.stakeholders.map(String) : undefined,
        acceptance:
          body.acceptance !== undefined ? asCopy(body.acceptance, 'acceptance') : undefined,
        dueAt: typeof body.dueAt === 'string' ? body.dueAt : undefined,
        readiness:
          body.readiness === 'READY' ||
          body.readiness === 'INCOMPLETE' ||
          body.readiness === 'DRAFT'
            ? body.readiness
            : undefined,
      });
      return { data: row };
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw new BadRequestException(err instanceof Error ? err.message : 'Invalid brief');
    }
  }

  @Post('requests/:id/convert')
  convertRequest(@Param('id') id: string) {
    this.requireDemo();
    try {
      const tasks = demoDataProvider.convertBriefToTasks(id);
      const request = demoDataProvider.getRequest(id);
      return { data: { request, tasks } };
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'Convert failed');
    }
  }

  @Get('tasks')
  tasks() {
    this.requireDemo();
    return { data: demoDataProvider.getGraph().tasks };
  }

  @Get('tasks/:id')
  task(@Param('id') id: string) {
    this.requireDemo();
    const row = demoDataProvider.getTask(id);
    if (!row) throw new NotFoundException('Not found');
    return { data: row };
  }

  @Post('tasks')
  createTask(@Body() body: Record<string, unknown>) {
    this.requireDemo();
    try {
      const type = String(body.type ?? 'DESIGN').toUpperCase();
      const row = demoDataProvider.createTask({
        title: asCopy(body.title, 'title'),
        description: body.description ? asCopy(body.description, 'description') : undefined,
        brandId: String(body.brandId ?? ''),
        campaignId: body.campaignId ? String(body.campaignId) : null,
        contentId: body.contentId ? String(body.contentId) : null,
        requestId: body.requestId ? String(body.requestId) : null,
        briefId: body.briefId ? String(body.briefId) : null,
        type: (['DESIGN', 'COPY', 'VIDEO', 'PHOTO'].includes(type) ? type : 'DESIGN') as
          'DESIGN' | 'COPY' | 'VIDEO' | 'PHOTO',
        status: typeof body.status === 'string' ? (body.status as never) : 'BACKLOG',
        assignee: String(body.assignee ?? 'Unassigned').trim(),
        priority: (['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(String(body.priority))
          ? String(body.priority)
          : 'MEDIUM') as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
        dueAt: String(body.dueAt ?? ''),
      });
      if (!row.brandId || !row.dueAt) {
        throw new BadRequestException('brandId and dueAt are required');
      }
      return { data: row };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(err instanceof Error ? err.message : 'Invalid task');
    }
  }

  @Patch('tasks/:id')
  updateTask(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    this.requireDemo();
    try {
      const patch: Parameters<typeof demoDataProvider.updateTask>[1] = {};
      if (body.title !== undefined) patch.title = asCopy(body.title, 'title');
      if (body.description !== undefined)
        patch.description = asCopy(body.description, 'description');
      if (typeof body.status === 'string') patch.status = body.status as never;
      if (typeof body.priority === 'string') patch.priority = body.priority as never;
      if (typeof body.assignee === 'string') patch.assignee = body.assignee;
      if (typeof body.dueAt === 'string') patch.dueAt = body.dueAt;
      if (Array.isArray(body.checklist)) {
        patch.checklist = body.checklist as NonNullable<typeof patch.checklist>;
      }
      if (body.blockedReason !== undefined) {
        patch.blockedReason =
          body.blockedReason === null ? null : asCopy(body.blockedReason, 'blockedReason');
      }
      const row = demoDataProvider.updateTask(id, patch);
      if (!row) throw new NotFoundException('Not found');
      return { data: row };
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw new BadRequestException(err instanceof Error ? err.message : 'Invalid task update');
    }
  }

  @Post('tasks/:id/comments')
  addTaskComment(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    this.requireDemo();
    const author = String(body.author ?? '').trim();
    if (!author) throw new BadRequestException('author is required');
    const row = demoDataProvider.addTaskComment(id, author, asCopy(body.body, 'body'));
    if (!row) throw new NotFoundException('Not found');
    return { data: row };
  }

  @Get('deliverables')
  deliverables() {
    this.requireDemo();
    return { data: demoDataProvider.getGraph().deliverables };
  }

  @Get('deliverables/:id')
  deliverable(@Param('id') id: string) {
    this.requireDemo();
    const row = demoDataProvider.getDeliverable(id);
    if (!row) throw new NotFoundException('Not found');
    return { data: row };
  }

  @Post('deliverables/from-task/:taskId')
  createFromTask(@Param('taskId') taskId: string) {
    this.requireDemo();
    try {
      const row = demoDataProvider.createDeliverableFromTask(taskId);
      return { data: row };
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'Create failed');
    }
  }

  @Post('deliverables/:id/revisions')
  addRevision(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    this.requireDemo();
    try {
      const row = demoDataProvider.addDemoRevision(id, {
        clientRequestId:
          typeof body.clientRequestId === 'string' ? body.clientRequestId : undefined,
        createdBy: typeof body.createdBy === 'string' ? body.createdBy : undefined,
      });
      if (!row) throw new NotFoundException('Not found');
      return { data: row };
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw new BadRequestException(err instanceof Error ? err.message : 'Revision failed');
    }
  }

  @Patch('deliverables/:id/current-version')
  selectVersion(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    this.requireDemo();
    try {
      const versionId = String(body.versionId ?? '');
      if (!versionId) throw new BadRequestException('versionId is required');
      const row = demoDataProvider.selectCurrentVersion(id, versionId);
      if (!row) throw new NotFoundException('Not found');
      return { data: row };
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw new BadRequestException(err instanceof Error ? err.message : 'Select failed');
    }
  }

  @Post('deliverables/:id/annotations')
  addAnnotation(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    this.requireDemo();
    try {
      const x = Number(body.x);
      const y = Number(body.y);
      if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) {
        throw new BadRequestException('x and y must be normalized 0..1');
      }
      const row = demoDataProvider.addAnnotation(id, {
        versionId: String(body.versionId ?? ''),
        x,
        y,
        author: String(body.author ?? 'Reviewer').trim(),
        body: asCopy(body.body, 'body'),
        timestampLabel:
          body.timestampLabel === null || body.timestampLabel === undefined
            ? null
            : String(body.timestampLabel),
      });
      if (!row) throw new NotFoundException('Not found');
      return { data: row };
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw new BadRequestException(err instanceof Error ? err.message : 'Annotation failed');
    }
  }

  @Post('deliverables/:id/comments')
  addDeliverableComment(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    this.requireDemo();
    try {
      const row = demoDataProvider.addGeneralComment(id, {
        versionId: String(body.versionId ?? ''),
        author: String(body.author ?? 'Reviewer').trim(),
        body: asCopy(body.body, 'body'),
      });
      if (!row) throw new NotFoundException('Not found');
      return { data: row };
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw new BadRequestException(err instanceof Error ? err.message : 'Comment failed');
    }
  }

  @Patch('deliverables/:id/annotations/:annotationId')
  resolveAnnotation(
    @Param('id') id: string,
    @Param('annotationId') annotationId: string,
    @Body() body: Record<string, unknown>,
  ) {
    this.requireDemo();
    try {
      const resolved = Boolean(body.resolved);
      const row = demoDataProvider.resolveAnnotation(id, annotationId, resolved);
      if (!row) throw new NotFoundException('Not found');
      return { data: row };
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw new BadRequestException(err instanceof Error ? err.message : 'Resolve failed');
    }
  }

  @Post('deliverables/:id/submit')
  submitReview(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    this.requireDemo();
    try {
      const row = demoDataProvider.submitForReview(id, String(body.versionId ?? ''));
      if (!row) throw new NotFoundException('Not found');
      return { data: row };
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw new BadRequestException(err instanceof Error ? err.message : 'Submit failed');
    }
  }

  @Post('deliverables/:id/decide')
  decide(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    this.requireDemo();
    try {
      const decision = String(body.decision ?? '').toUpperCase();
      if (!['APPROVED', 'CHANGES_REQUESTED', 'REJECTED'].includes(decision)) {
        throw new BadRequestException('Invalid decision');
      }
      const row = demoDataProvider.decideReview(id, {
        decision: decision as 'APPROVED' | 'CHANGES_REQUESTED' | 'REJECTED',
        versionId: String(body.versionId ?? ''),
        actor: String(body.actor ?? 'Reviewer').trim(),
        reason: body.reason ? asCopy(body.reason, 'reason') : undefined,
      });
      if (!row) throw new NotFoundException('Not found');
      return { data: row };
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw new BadRequestException(err instanceof Error ? err.message : 'Decision failed');
    }
  }

  @Get('schedule')
  schedule() {
    this.requireDemo();
    return { data: demoDataProvider.getGraph().scheduledPosts };
  }

  @Patch('schedule/:id')
  updateSchedule(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    this.requireDemo();
    try {
      const patch: {
        plannedAt?: string;
        channels?: string[];
        state?: DemoScheduleState;
      } = {};
      if (body.plannedAt !== undefined) {
        if (typeof body.plannedAt !== 'string' || !body.plannedAt.trim()) {
          throw new BadRequestException('plannedAt must be a valid ISO datetime');
        }
        patch.plannedAt = body.plannedAt;
      }
      if (body.channels !== undefined) {
        if (!Array.isArray(body.channels)) {
          throw new BadRequestException('channels must be an array');
        }
        patch.channels = body.channels.map(String);
      }
      if (body.state !== undefined) {
        const allowed: DemoScheduleState[] = [
          'PLANNED',
          'READY',
          'SCHEDULED_PREVIEW',
          'BLOCKED',
          'PUBLISHED_SAMPLE',
        ];
        if (typeof body.state !== 'string' || !allowed.includes(body.state as DemoScheduleState)) {
          throw new BadRequestException('Invalid schedule state');
        }
        patch.state = body.state as DemoScheduleState;
      }
      const row = demoDataProvider.updateScheduledPost(id, patch);
      if (!row) throw new NotFoundException('Not found');
      return { data: row };
    } catch (err) {
      if (err instanceof NotFoundException || err instanceof BadRequestException) throw err;
      throw new BadRequestException(err instanceof Error ? err.message : 'Invalid schedule update');
    }
  }

  @Delete('schedule/:id')
  removeSchedule(@Param('id') id: string) {
    this.requireDemo();
    const ok = demoDataProvider.removeScheduledPost(id);
    if (!ok) throw new NotFoundException('Not found');
    return { data: { id, removed: true } };
  }

  @Get('preferences')
  preferences() {
    this.requireDemo();
    return { data: demoDataProvider.getDemoPreferences() };
  }

  @Patch('preferences')
  updatePreferences(@Body() body: Record<string, unknown>) {
    this.requireDemo();
    try {
      const partial: Partial<DemoPreferences> = {};
      if (body.timezone !== undefined) {
        if (typeof body.timezone !== 'string' || !body.timezone.trim()) {
          throw new BadRequestException('timezone is required');
        }
        partial.timezone = body.timezone.trim();
      }
      if (body.weekStart !== undefined) {
        if (body.weekStart !== 'monday' && body.weekStart !== 'sunday') {
          throw new BadRequestException('weekStart must be monday or sunday');
        }
        partial.weekStart = body.weekStart;
      }
      if (body.defaultContentView !== undefined) {
        if (
          body.defaultContentView !== 'list' &&
          body.defaultContentView !== 'calendar' &&
          body.defaultContentView !== 'feed' &&
          body.defaultContentView !== 'grid'
        ) {
          throw new BadRequestException('defaultContentView must be list, calendar, feed, or grid');
        }
        partial.defaultContentView = body.defaultContentView;
      }
      if (body.approvalPolicy !== undefined) {
        if (
          body.approvalPolicy !== 'NONE' &&
          body.approvalPolicy !== 'OPTIONAL' &&
          body.approvalPolicy !== 'REQUIRED'
        ) {
          throw new BadRequestException('approvalPolicy must be NONE, OPTIONAL, or REQUIRED');
        }
        partial.approvalPolicy = body.approvalPolicy;
      }
      if (body.defaultTaskView !== undefined) {
        if (body.defaultTaskView !== 'board' && body.defaultTaskView !== 'list') {
          throw new BadRequestException('defaultTaskView must be board or list');
        }
        partial.defaultTaskView = body.defaultTaskView;
      }
      if (body.reviewReminders !== undefined) {
        partial.reviewReminders = Boolean(body.reviewReminders);
      }
      if (body.localePreference !== undefined) {
        if (
          body.localePreference !== 'en' &&
          body.localePreference !== 'ar' &&
          body.localePreference !== 'system'
        ) {
          throw new BadRequestException('localePreference must be en, ar, or system');
        }
        partial.localePreference = body.localePreference;
      }
      const row = demoDataProvider.updateDemoPreferences(partial);
      return { data: row };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(err instanceof Error ? err.message : 'Invalid preferences');
    }
  }

  @Get('analytics')
  analytics() {
    this.requireDemo();
    return { data: demoDataProvider.getGraph().analytics };
  }

  @Get('team')
  team() {
    this.requireDemo();
    return { data: demoDataProvider.getGraph().members };
  }

  @Get('activity')
  activity() {
    this.requireDemo();
    return { data: demoDataProvider.getGraph().activity };
  }

  @Get('notifications')
  notifications() {
    this.requireDemo();
    return { data: demoDataProvider.getGraph().notifications };
  }

  @Get('integrations')
  integrations() {
    this.requireDemo();
    return { data: demoDataProvider.getGraph().integrations };
  }

  @Get('command-center')
  commandCenter() {
    this.requireDemo();
    const g = demoDataProvider.getGraph();
    return {
      data: {
        ...g.commandCenter,
        brands: g.brands,
        campaigns: g.campaigns,
        meta: g.meta,
      },
    };
  }

  private requireDemo() {
    const env = loadEnv();
    try {
      assertDemoModeAllowed({
        NODE_ENV: env.NODE_ENV,
        OMA_DEMO_MODE: env.OMA_DEMO_MODE ? '1' : '0',
        OMA_DEMO_ALLOW_PRODUCTION: env.OMA_DEMO_ALLOW_PRODUCTION ? '1' : '0',
      });
    } catch (err) {
      throw new ForbiddenException(err instanceof Error ? err.message : 'Demo mode is not enabled');
    }
  }
}
