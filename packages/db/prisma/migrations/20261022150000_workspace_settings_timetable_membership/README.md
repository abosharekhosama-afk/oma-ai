# Migration: workspace settings + timetable + membership kind

## Already present (no action)
- `ContentLabel` — brand-scoped labels
- `ContentTemplate` — brand-scoped templates  
- `CalendarDayNote`
- `AuditEvent`
- `Membership` core + capability grants

## This migration adds
| Table / column | Purpose |
|----------------|---------|
| `WorkspaceSetting` | General + approval workflow per tenant |
| `WorkspaceTimeSlot` | Preferred posting slots (Planable Timetable) |
| `Membership.membershipKind` | `team` \| `client` |
| `Membership.displayRole` | Owner, Contributor, Approver, … |

## Apply
```bash
cd packages/db
pnpm migrate:deploy
# or
pnpm migrate:dev
pnpm generate
```

## API (after registering WorkspaceSettingsController)
- `GET/PATCH /api/v1/workspace/settings`
- `GET/POST /api/v1/workspace/time-slots`
- `DELETE /api/v1/workspace/time-slots/:id`

Register the controller in `apps/api` app module / container alongside other controllers.
