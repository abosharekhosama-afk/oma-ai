# Contract: Ingestion & AI Ports (002 usage)

**Feature**: `002-brand-website-intelligence`  
**Status**: `DRAFT FOR REVIEW`  
**Authority**: Foundation `packages/domain` ports + clarifications `SR-002-004-MODE`, `SR-002-007-AI`  
**Note:** Extends **usage** of existing ports; does not select vendors or add SDKs.

---

## `WebsiteConnectorPort` (crawl boundary)

Foundation shape (current code):

- `validateSource({ url }) → { ok, reason? }`
- `startIngestion(runId) → void`
- `getProgress(runId) → { status, percent }`

### Planned 002 usage

| Phase | Who calls | Behavior |
| ----- | --------- | -------- |
| Connect website | API | May call `validateSource` after HTTPS/SSRF normalize; persist WebsiteSource |
| Ingestion job | Worker | Drive crawl loop **through** port methods (see additive surface below) |
| Progress | Worker/API | Persist ScanAttempt progress; port progress is advisory |

### Planned additive port surface (Spec sync required at implement — still no vendor)

Additive methods remain behind `WebsiteConnectorPort` (or a narrow extension interface composed into the same adapter). Documented now to prevent crawl logic drifting into controllers:

| Method (planned) | Responsibility |
| ---------------- | -------------- |
| `fetchPublic(input)` | Fetch one URL with timeout/size limits; return status, headers, bounded body/excerpt bytes, redirect chain metadata |
| `resolveRedirectTarget(url)` | Expose next hop for **caller** re-validation (SSRF/DNS) before follow |
| `evaluateRobots(host, path)` | robots.txt decision for path (or explicit unsupported → fail closed / skip) |
| `validateSource` / `startIngestion` / `getProgress` | Retain Foundation methods; `startIngestion` may orchestrate multi-fetch **or** worker may orchestrate calling `fetchPublic` — pick one at implement and keep SoT in worker + port |

**Normative:** SSRF/DNS/host policy re-check lives in OMA caller **before each fetch**; adapter must not silently follow disallowed redirects.

### Adapters

| Adapter | Where | Purpose |
| ------- | ----- | ------- |
| `refusingWebsiteConnector` | Default production until authorized live wiring | Throws / returns not configured (`DEC-004` / vendor gate) |
| Deterministic fixture connector | **Tests / local quickstart only** | Serves `tests/fixtures/websites/*` over loopback allowlist |
| Future live public fetch | **Hard stop** until product + security authorize | First-party HTTPS fetch behind port; still no commerce |

### Security obligations (caller + adapter)

- Re-validate every redirect target (SSRF, DNS, private ranges, metadata, credentials, scheme/port).
- Timeouts, max bytes, content-type allowlist, decompression limits.
- No login/paywall bypass.
- Respect robots + rate budgets.
- Never write crawl results for wrong `tenant_id` / `scan_attempt_id`.

### Forbidden in 002 implement

- Commerce API / store connector as SoT
- Selecting a crawl SaaS vendor in code/config as production default
- Public-internet crawl in CI

---

## `AiProviderPort` (proposal boundary)

Foundation shape:

- `generate(AiGenerateRequest) → AiGenerateResult`
- Request carries `tenantId`, `purpose`, `inputSnapshotRefs`, `prompt`
- Result carries `outputRef`, `providerCode`, `modelCode?`, `confidence?`, `unknowns`

### Planned 002 usage

| Condition | Behavior |
| --------- | -------- |
| Production default | `refusingAiProvider` → `AiProviderNotConfiguredError` |
| Analysis job | Catch not-configured / timeout / quota → set `ai_availability=NOT_CONFIGURED|UNAVAILABLE`; **do not** fail whole journey if observations usable → ScanAttempt `PARTIAL` |
| Success (future / test double) | Persist proposals as `AI_INFERRED` with provenance; never auto-approve |
| Tests only | In-memory stub returning fixed proposals |

### Forbidden until `DEC-007` closed + authorized wiring

- AI SDK dependency
- API keys / credentials in env for live providers
- Sending tenant data to third parties
- Choosing production model/region/retention/cost policy as “decided”
- AI calling approve/reject version endpoints

### Prompt / data hygiene (when live later)

- Pass **excerpts and structured observations**, not full site mirrors (DEC-003).
- Include provenance on every proposal.
- Arabic: future acceptance tests; not assumed.

---

## Job payload correlation (deterministic)

Bull job payload (snake_case), matching foundation mail pattern:

```json
{
  "job_run_id": "01…",
  "scan_attempt_id": "01…",
  "tenant_id": "01…",
  "brand_id": "01…",
  "correlation_id": "…",
  "actor_user_id": "01…",
  "idempotency_key": "scan:start:…"
}
```

Bull custom job id: `ingestion-{jobRunId}` or `analysis-{jobRunId}` (no `:`).

Worker MUST load `JobRun` by `job_run_id` and verify `tenant_id` + `scan_attempt_id` match before mutate.

---

## Decision Gate reminder

| Gate | Port | Live wiring |
| ---- | ---- | ----------- |
| `SR-002-004-MODE` / DEC-004 | WebsiteConnectorPort | Fixture/test OK; production vendor Hard Stop |
| `SR-002-007-AI` / DEC-007 | AiProviderPort | Test double OK; live Hard Stop |
| DEC-003 | Evidence storage | Excerpts only; no ObjectStorage assumption |
