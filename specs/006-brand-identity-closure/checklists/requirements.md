# Requirements checklist — 006 Brand identity analysis closure

**Scope**: FR-BWI-026 identity slices (overview, tone, audiences, messaging, visual, contact, social, languages) — provider-neutral CORE only.

Mark `[x]` only with test or CI evidence.

## Engineering closure

- [x] CHK-IDENT-001 Crawl observations bootstrap profile identity sections (`bootstrapIdentitySectionsFromObservations`, worker profile draft)
- [x] CHK-IDENT-002 Accepting insights updates sections including JSON logo/colors/contact (`applyAcceptedInsightClaimToSections`)
- [x] CHK-IDENT-003 Profile approve reconciles accepted insights into `sectionsJson` (`profile.identity_materialized`)
- [x] CHK-IDENT-004 API exposes `identity_completeness` on profile GET
- [x] CHK-IDENT-005 Unit tests `tests/unit/brand-identity-sections.test.ts`

## Explicit non-goals

- Full Jasper Brand IQ parity (competitors, content pillars → strategy slice)
- Live AI required for closure (tone/audiences may remain human or AI proposals)
- Pixel / Planable visual PASS (DEC-017)

## Label when CHK-IDENT-001–005 pass

`BRAND_IDENTITY_ANALYSIS: CORE_CLOSED` — narrative sections still require human accept or AI proposals where crawl is silent.
