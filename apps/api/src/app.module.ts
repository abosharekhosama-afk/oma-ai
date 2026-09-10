import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { DomainExceptionFilter } from './common/filters/domain-exception.filter';
import { CorrelationMiddleware } from './common/middleware/correlation.middleware';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor';
import { HealthController } from './health/health.controller';
import { AuthController } from './identity/auth.controller';
import { RecoveryController } from './identity/recovery.controller';
import { AuditController } from './audit/audit.controller';
import { TenantController } from './tenant/tenant.controller';
import { MembershipController } from './tenant/membership.controller';
import { CapabilityController } from './tenant/capability.controller';
import { JobsController } from './jobs/jobs.controller';
import { NotificationsController } from './notifications/notifications.controller';
import { BrandController } from './brand/brand.controller';
import { WebsiteController } from './brand/website.controller';
import { ScanController } from './brand/scan.controller';
import { DiscoveryController } from './discovery/discovery.controller';
import { ProfileController } from './intelligence/profile.controller';
import { StrategyController } from './strategy/strategy.controller';
import { DemoController } from './demo/demo.controller';

@Module({
  controllers: [
    HealthController,
    AuthController,
    RecoveryController,
    AuditController,
    TenantController,
    MembershipController,
    CapabilityController,
    JobsController,
    NotificationsController,
    BrandController,
    WebsiteController,
    ScanController,
    DiscoveryController,
    ProfileController,
    StrategyController,
    DemoController,
  ],
  providers: [
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
