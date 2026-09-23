# Planable product workflow baseline

**Evidence:** registry in `docs/PLANABLE_OFFICIAL_SOURCE_REGISTRY.md`.  
**Access date:** 2026-09-23.

## Primary path

```
Workspace
→ Pages / channels
→ Campaign (public API v2; labels also organize campaigns)
→ Create content
→ Draft (date optional)
→ Collaborate
→ Request approval
→ Approve or still unapproved
→ Schedule (command, not the date picker)
→ Publish result
→ Analyze
```

## Steps proven by official sources

| Step             | Proven behavior                                                                                                                                                                        | Evidence                          |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Workspace        | Created with an approval workflow: None, Optional, Required, or Multi-level. Auto-schedule and lock-after-approval are settings. Approver assignment waits until invites are accepted. | EV-HC-WS                          |
| Pages            | Sidebar selects one page or all. Schedule targets connected social pages.                                                                                                              | EV-HC-CAL, EV-HC-SCHED            |
| Campaign         | Changelog lists campaign create/view/edit/delete and add/remove posts on the public API. Labels also group posts by campaign.                                                          | EV-CHG-V2, EV-HC-FILTER           |
| Create           | A post can be saved as a draft with or without a date and time.                                                                                                                        | EV-HC-SCHED                       |
| Draft            | Grey platform icon. Date does not mean scheduled.                                                                                                                                      | EV-HC-STATUS, EV-HC-SCHED         |
| Collaborate      | Comments, suggestions, annotations, and one-time feedback links are named on the marketing site. Filters include feedback and activity. Visibility can be team-only or all members.    | EV-MKT-HOME, EV-HC-FILTER         |
| Request approval | Hover the approval icon and choose Request Approval.                                                                                                                                   | EV-HC-APPROVAL                    |
| Approve          | Approve permission required. Required workflow: at least one approver. Multi-level: one approver finishes a level; all levels finish the post. Unapprove by clicking again.            | EV-HC-APPROVE, EV-HC-ML           |
| Lock             | Optional setting prevents edits after approval.                                                                                                                                        | EV-HC-WS                          |
| Schedule         | Explicit Schedule command, or auto-schedule on approve when a date and time already exist.                                                                                             | EV-HC-SCHED, EV-HC-APPROVAL       |
| Publish          | Publish now, or the scheduled time. Failed and cannot-schedule are separate icon states. Mark as published covers posts published outside Planable.                                    | EV-HC-SCHED, EV-HC-STATUS         |
| Analyze          | Marketing names analytics and reports. API can pull page/post analytics and trigger a metrics sync. Competitor analytics is an add-on.                                                 | EV-MKT-HOME, EV-HC-API, EV-CHG-V2 |

## Alternate and failure paths

| Path                    | Behavior                                                                                                                            | Evidence                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| No approval             | Workflow None disables approvals. Optional still allows schedule and publish without approval.                                      | EV-HC-WS, EV-HC-APPROVAL   |
| Required and unapproved | Schedule and publish are blocked.                                                                                                   | EV-HC-APPROVAL             |
| Undated                 | Stays in the Calendar Saved column until dragged onto a day.                                                                        | EV-HC-CAL                  |
| Cannot schedule         | Orange icon. Hover names causes such as disconnected page, processing, invalid content, or missing mobile app for Instagram/TikTok. | EV-HC-STATUS               |
| Failed publish          | Red icon. Hover explains the failure.                                                                                               | EV-HC-STATUS               |
| Imported                | Cloud icon. Not the same as published-by-Planable.                                                                                  | EV-HC-STATUS               |
| Facebook extras         | Creator Studio draft and Ads Manager dark-post draft are extra icon states.                                                         | EV-HC-STATUS               |
| Empty calendar day      | Calendar notes can sit on a day without a post.                                                                                     | EV-HC-CAL                  |
| Empty views             | Deselect Published to hide published posts. Custom views can show only pending approval.                                            | EV-HC-FILTER, EV-HC-CUSTOM |

## Permissions (as stated)

- Approve requires an Approve permission. `EV-HC-APPROVE`
- Owners and editors edit brand context. Client visibility of that context is a choice. `EV-CHG-HOME`
- Public API is Pro and Enterprise. Multi-level approval is Enterprise. `EV-CHG-V2`, `EV-HC-ML` — `PLAN_GATED`

Reject and request-changes as named commands are `UNKNOWN` in this pack. Official text proves Request Approval, Approve, and Unapprove.
