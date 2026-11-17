# DP-005-003 — Plan-requests catalog fallback

**Status**: `PROPOSED` (default **Option A**)

## Question

If approved profile `sectionsJson.catalog` is empty but discovery has products, may plan-requests use discovery rows?

## Options

| Option | Behavior |
| ------ | -------- |
| **A (recommended)** | Read-only fallback from latest `SUCCEEDED`/`PARTIAL` scan; response includes `catalog_source: discovery_fallback` + audit |
| **B** | Deny preview; force user to refresh catalog on profile |
| **C** | Always merge discovery silently into preview |

## Recommendation

**A** — honest, fixes linkage gap without violating approved-profile SoT fiction.