# Analytics performance, caching and timezone

## Indexes (migration `20261026110000_analytics_indexes`)
Composite indexes used by `/api/v1/analytics` and `/api/v1/analytics/content` date-window queries:
`ContentItem(tenantId, scheduledAt|plannedAt|createdAt|channel)`, `ContentApprovalEvent(tenantId, at)`,
`ContentComment(tenantId, createdAt)`. Deploy with `pnpm db:migrate:deploy`.
Benchmark: `scripts/bench/analytics-bench.ts` (BENCH_TENANT, BENCH_BRAND).

## Cache (`apps/api/src/analytics/analytics-cache.ts`)
- 60s TTL; Redis when `REDIS_URL` is set (`ANALYTICS_CACHE=memory` forces memory), in-process LRU (500) fallback on any Redis error.
- Key: `oma:analytics:v1:{tenantId}:g{generation}:{userId}:{endpoint}:{sorted params}`.
- Capability guard runs before the cache, so revoked access is never served from cache.
- Invalidation: `AnalyticsInvalidationInterceptor` (global) bumps `oma:analytics:v1:gen:{tenantId}` after every
  successful POST/PUT/PATCH/DELETE in that tenant (content, approvals, comments, tasks, deliverables…), awaited before
  the response. Worker-side writes are bounded by the TTL.

## Timezone
Day/week buckets and date ranges use **ContentPreferences.defaultTimezone** (per brand) — the value scheduling uses
(ContentItem.timezone default, composer WORKSPACE_TZ, `/content/preferences`). WorkspaceSetting.timezone is not read by
scheduling and is not used here; unifying the two belongs to the brand PR. Without a brand filter: the common zone of all
live brands, else `Asia/Dubai`. Home "this week" strip uses the same zone (API returns `week.timezone` and `week.days`).
