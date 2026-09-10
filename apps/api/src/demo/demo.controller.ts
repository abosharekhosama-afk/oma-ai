import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { assertDemoModeAllowed, demoDataProvider, isDemoModeEnabled } from '@oma/demo';
import { AuthGuard } from '../common/guards/auth.guard';
import { loadEnv } from '@oma/config';

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
