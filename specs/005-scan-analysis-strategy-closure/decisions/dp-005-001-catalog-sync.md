# DP-005-001 — Catalog materialization into profile

**Status**: `OWNER_APPROVED` — **Option B** (implement default, 2026-11-17)
**Feature**: `005-scan-analysis-strategy-closure`

## Question

When should `sectionsJson.catalog` in a `ProfileVersion` reflect rows in `discoveredProductService`?

## Options

| Option              | Behavior                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------ |
| **A**               | Continuous sync on every scan completion into **latest draft** only                                    |
| **B (recommended)** | On **draft refresh catalog** command + mandatory step on **approve** (merge from latest eligible scan) |
| **C**               | Never auto; manual editor only                                                                         |

## Recommendation

**B** — preserves immutability of approved versions, matches “human approves catalog truth,” and fixes plan-requests empty catalog without silent retroactive edits.

## Unlocks

FR-SAS-004, US-SAS-04, SC-SAS-002
