# TikTok Publishing and Schedule Views

**Status:** Implemented behavior baseline  
**Scope:** TikTok media publishing/reconciliation and OMA Schedule Agenda/Queue presentation.

## Goals

Make TikTok publishing constraints explicit before submission, preserve TikTok's asynchronous publish result as the source of truth, expose actionable provider failures, and make Agenda and Queue useful on desktop and mobile without duplicating calendar content.

## TikTok publishing requirements

- A TikTok post contains either one video or a photo carousel; photo and video assets MUST NOT be mixed in one post.
- Photo carousels accept 1–35 photos. TikTok photo media MUST use JPEG or WebP. Each photo MUST be at most 20 MB.
- A video post accepts exactly one video. Video media MUST use MP4, WebM, or MOV and MUST be at most 4 GB. Additional videos MUST be authored as separate posts/drafts; a multi-video request MUST fail validation rather than silently combining videos.
- The provider request MUST use original, publicly reachable media download URLs compatible with TikTok's verified URL-prefix requirements, not private or preview-only URLs. Missing media, unsupported MIME types, size/count violations, and mixed media MUST fail before the provider publish call with a provider code and explanatory message.
- Publishing authorization MUST include the TikTok `video.publish` scope, and the configured privacy option MUST be among the creator's supported privacy options. Missing scope or invalid privacy options MUST remain an actionable, non-retryable failure.

## Publish state machine

| Current state | Event/result                                                       | Next state           | Required behavior                                                                                                                |
| ------------- | ------------------------------------------------------------------ | -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `QUEUED`      | Worker submits a valid post; TikTok returns a publish operation ID | `PUBLISHING`         | Persist the operation ID and schedule status reconciliation; do not report success yet.                                          |
| `PUBLISHING`  | TikTok status is still processing                                  | `PUBLISHING`         | Poll again later; retain pending state and do not mark the content published.                                                    |
| `PUBLISHING`  | TikTok reports `PUBLISH_COMPLETE`                                  | `PUBLISHED`          | Store the final post ID/URL and completion time; clear the publish error and sync the content roll-up.                           |
| `PUBLISHING`  | TikTok reports `FAILED` or status lookup fails permanently         | `FAILED` or `QUEUED` | Preserve the literal provider error; retry only when the failure is retryable and attempts remain, using the configured backoff. |
| `PUBLISHING`  | A transient status lookup failure occurs                           | `PUBLISHING`         | Preserve diagnostic detail and schedule another status poll; do not infer success or final failure from an unconfirmed response. |

Only TikTok's terminal success status may transition a TikTok target to `PUBLISHED`. Provider failure codes and the server's original error text MUST remain available to the Schedule detail view; user-facing remediation MUST accompany the raw diagnostic in English and Arabic where localized copy is available. Authorization failures MUST identify the reconnect action. Retryable failures MUST be distinct from permanent media/validation failures.

## Schedule Agenda and Queue requirements

- Agenda MUST present scheduled items in ascending chronological order as a readable single-column timeline, including date/time, status, channels, and a clear route to the schedule detail.
- Queue MUST present the same chronological ordering as scan-friendly cards in a responsive grid; at widths of 900 px or less it MUST collapse to one column.
- Agenda and Queue content MUST have an independent vertical scroll region below the schedule controls. Scrolling must work with touch, preserve horizontal layout, and avoid scroll chaining where supported. The controls remain available while users browse long lists.
- The compact mobile week list is reserved for Calendar mode. Agenda and Queue MUST hide that fallback list so schedule entries are not duplicated.
- Card content MUST remain constrained to the available width and preserve readable title, body, channel, status, and readiness details at narrow viewport sizes.

## Acceptance criteria

1. Valid single-video and photo-carousel submissions pass media-shape validation; mixed media, multiple videos, unsupported formats, over-limit photo counts, and over-limit known file sizes fail with explicit provider diagnostics.
2. A successful TikTok publish-init response is treated as pending, not published; the worker polls until a provider terminal result is confirmed.
3. Permanent failures are visible in schedule details with the original server/provider diagnostic and remediation; retryable failures remain pending/retryable according to worker policy.
4. Agenda and Queue order entries chronologically, scroll independently beneath their controls, adapt at mobile widths, and do not duplicate the compact calendar list.
