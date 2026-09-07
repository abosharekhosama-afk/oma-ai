# Gap Matrix Index — Feature 002

| Artifact                    | Path                                                                                         |
| --------------------------- | -------------------------------------------------------------------------------------------- |
| Runtime / root-cause audit  | [`00-runtime-root-cause.md`](./00-runtime-root-cause.md)                                     |
| OMA application inventory   | [`01-oma-application-inventory.md`](./01-oma-application-inventory.md)                       |
| Gap matrix                  | [`02-gap-matrix.md`](./02-gap-matrix.md)                                                     |
| Visual baseline             | [`03-visual-baseline.md`](./03-visual-baseline.md)                                           |
| False-completion findings   | [`04-false-completion.md`](./04-false-completion.md)                                         |
| Reference evidence baseline | [`../reference/`](../reference/)                                                             |
| Reference pattern inputs    | [`../reference/07-reference-pattern-matrix.md`](../reference/07-reference-pattern-matrix.md) |

**Phase status:** `IMPLEMENT_REFERENCE_GAPS_002` in progress · `DEC-015: RESOLVED — OPTION A` (2026-09-04)

Prior matrix status: `REFERENCE_TO_OMA_GAP_MATRIX_002: READY_FOR_IMPLEMENTATION`

Auditors: Reference Evidence PASS; Gap Matrix PASS; Task PASS; False-Completion PASS; Convergence PASS. Docs commit `6fa853b` (+ this status line). No product code in this phase.

**Served commit under audit:** `1a7453c`

**Root cause summary:** `MISSING_DEMO_DATA` + switcher discoverability (`G-003`/`G-005`) for the
bootstrap owner; `RECONNECT` create-company UI over existing `POST /tenants` (`G-001`) for every self-registered user;
`TEST_FALSE_POSITIVE` helpers that never exercise login, tenant switcher, or create-company UI
(`FC-001`, `FC-002`).
