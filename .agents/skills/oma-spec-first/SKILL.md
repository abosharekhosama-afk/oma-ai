---
name: oma-spec-first
description: Define or change OMA AI product behavior before implementation. Use for new features, scope changes, roles, permissions, workflows, states, AI behavior, client journeys, website ingestion, WorkDrive, pricing, publishing, Meta, or any request whose intended behavior is not already explicit in the smallest relevant spec.
---

# OMA AI Spec-First Workflow

1. Read `AGENTS.md`, `.specify/memory/constitution.md`, and the smallest relevant artifact under `specs/`. For shell, UI, interaction, motion, or visual requests, also read `docs/DESIGN_REFERENCE_STRATEGY.md`.
2. Classify the request as product definition, clarification, change, or contradiction.
3. Inspect the actual repository only enough to identify existing owners, integrations, constraints, and conflicts. Do not select architecture during product specification.
4. Define or update:
   - outcome and non-goals;
   - actors and capabilities;
   - independently testable journeys and acceptance scenarios;
   - functional requirements with stable IDs;
   - logical owner, physical owner, authoritative writer, readers, tenant gate, permissions, events, and consumers;
   - canonical states, transitions, approval target, version behavior, failures, concurrency, retries, and idempotency;
   - AI provenance and accountable human decisions;
   - integration boundaries and external sources of truth;
   - EN/AR, RTL/LTR, responsive, accessibility, notification, deep-link, and persistence behavior;
   - for UI work: screen archetype, primary reference behavior, original OMA adaptation, tokens/surface/motion intent, and non-copying boundary;
   - measurable outcomes, deferred scope, assumptions, and open decisions.
5. Update only the smallest authoritative spec. Link to shared definitions instead of duplicating them.
6. Run the applicable requirements checklist and label unresolved decisions as `BLOCKER` only when they materially change behavior, architecture, security, cost, or external actions.
7. Stop before `plan`, `tasks`, schemas, routes, or product code while affected blocker decisions remain. Do not plan the base UI design system until `DEC-013` is approved.

When the requested behavior is driven by an external reference product, request reference inspection before finalizing behavior instead of describing the reference from memory: read `.reference/registry.json` for the reference's authority and access policy, run the inspection modes the scope needs, and cite the resulting artifacts. Record what could not be observed as an unknown rather than a requirement. `docs/REFERENCE_PARITY_PROTOCOL.md` is canonical.

Return the changed spec paths, requirement/decision IDs, resolved ambiguity, reference artifacts relied on, remaining blockers, and the next permitted Spec Kit stage.
