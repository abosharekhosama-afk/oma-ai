import {
  BadRequestException,
  Body,
  Controller,
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
  type DemoContentInput,
  type DemoContentPatch,
  type DemoLocaleCopy,
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
        }),
        label: demoDataProvider.getGraph().meta.label,
        production_blocked: env.NODE_ENV === 'production',
      },
    };
  }

  @Get('graph')
  graph(@Res({ passthrough: true }) res: Response) {
    this.requireDemo();
    res.setHeader('x-oma-demo-data', '1');
    return { data: demoDataProvider.getGraph() };
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

  @Get('requests/:id')
  request(@Param('id') id: string) {
    this.requireDemo();
    const row = demoDataProvider.getRequest(id);
    if (!row) throw new NotFoundException('Not found');
    const brief = demoDataProvider.getGraph().briefs.find((b) => b.requestId === id) ?? null;
    return { data: { ...row, brief } };
  }

  @Get('tasks')
  tasks() {
    this.requireDemo();
    return { data: demoDataProvider.getGraph().tasks };
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

  @Get('schedule')
  schedule() {
    this.requireDemo();
    return { data: demoDataProvider.getGraph().scheduledPosts };
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
      });
    } catch (err) {
      throw new ForbiddenException(err instanceof Error ? err.message : 'Demo mode is not enabled');
    }
  }
}
