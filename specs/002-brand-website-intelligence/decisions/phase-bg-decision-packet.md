# Phase BG Decision Packet — Feature 002 Live Crawl & Live AI

**Status:** `READY_FOR_OWNER_DECISION`  
**Branch:** `docs/002-phase-bg-decision-packet`  
**Base:** `origin/main` @ `5d27357e766d23f3c6f898453ae0e84ba862e862`  
**Research date:** 2026-09-08  
**Authority:** Foundation `specs/001-oma-ai-product-foundation/spec.md` §17; Feature 002 `plan.md` / `tasks.md` Phase BG; ports in `packages/domain/src/ports/`  
**Mode:** Docs only — **no** implementation, **no** decision closure, **no** Feature 003

---

## Owner executive summary

Two Owner choices unlock useful Phase BG live value without reopening accepted Feature 002:

1. **Crawl approach (DEC-004-scoped / authorized crawl decision)** → unlocks **T200–T201**.
2. **AI provider + policy (DEC-007)** → unlocks **T202–T203**.

**DEC-003 is not required** for useful live crawl + AI while excerpts/hashes/URLs remain the evidence SoT.  
**T204–T208**, commerce, and most other DECs can stay deferred.

### RECOMMENDATION — NOT YET APPROVED (crawl)

Prefer **Option C1 — Self-managed public HTTPS connector** behind existing `WebsiteConnectorPort` / worker for launch: OMA keeps SSRF/robots/idempotency ownership already designed in 002, lowest recurring vendor cost, and no third-party page retention. Add **Firecrawl (C2)** only if Owner accepts managed JS-heavy crawl + credit spend + DPA/ZDR tradeoffs. Treat **Browserbase (C3)** as escalation for stealth/browser-hour workloads, not default Brand Intelligence fetch.

### RECOMMENDATION — NOT YET APPROVED (AI)

Prefer **Option A2 — Anthropic Claude API (Sonnet 5 class) via `AiProviderPort`** for structured Brand Intelligence proposals: official structured outputs, published ZDR/DPA path, strong EN/AR extraction quality, predictable $/MTok. Keep **OpenAI (A1)** as competitive alternative if IMKAN already standardizes there and ZDR/residency eligibility is confirmed. Use **Gemini via Vertex (A3)** if Google Cloud residency/VPC is a hard enterprise constraint. Always keep refusing/manual path and budget kill switches.

**Do not select on behalf of the Owner.** Exact choices are listed at the end of each decision section.

---

## 1. What each decision still requires

| Decision                | Registry status                                      | What Owner must still decide for Phase BG                                                                                                                                                                                                             | Unlocks                    |
| ----------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| **DEC-004** (global)    | Open — “crawl vs commerce vs both?”                  | For Phase BG **public HTTPS only** (already slice-locked by `SR-002-004-MODE`): authorize **which live fetch mechanism** (self-managed vs managed vendor) + egress/SSRF ownership + robots policy + spend caps. Commerce remains out of 002 (`T208`). | **T200, T201**             |
| **DEC-007**             | Open — provider/model/region/retention/cost/fallback | Select provider + default model tier, retention (default vs ZDR), processing region, logging, monthly budget + kill switch, fallback (manual/refusing).                                                                                               | **T202, T203**             |
| **DEC-003**             | Open — file/byte ownership                           | **Not required** for live crawl/AI if excerpts remain SoT.                                                                                                                                                                                            | T204–T205 only             |
| **DEC-005/006/008–012** | Open                                                 | Not required to ship useful live crawl + AI for Brand Website Intelligence.                                                                                                                                                                           | Outside Phase BG live path |
| **T206 / T207**         | Open                                                 | ESP productization / hosting-CDN — not crawl/AI prerequisites.                                                                                                                                                                                        | Ops / Foundation           |

**Hard prerequisites for useful live crawl + AI:** authorized crawl decision (DEC-004-scoped) + closed DEC-007 + explicit implement authorization (`tasks.md`).

---

## 2. Tasks map (T200–T208)

| Task | Blocker                    | Unlocked by        | Notes                                           |
| ---- | -------------------------- | ------------------ | ----------------------------------------------- |
| T200 | DEC-004 / authorized crawl | Crawl Owner choice | Live `WebsiteConnectorPort` adapter + worker DI |
| T201 | DEC-004 / authorized crawl | Crawl Owner choice | Prod crawl env + egress observability           |
| T202 | DEC-007                    | AI Owner choice    | Live `AiProviderPort` adapter + worker DI       |
| T203 | DEC-007                    | AI Owner choice    | Region/retention/cost policy in config + port   |
| T204 | DEC-003                    | **Deferrable**     | Full-page HTML/binary store                     |
| T205 | DEC-003                    | **Deferrable**     | WorkDrive duplicate bytes                       |
| T206 | Foundation ESP             | **Deferrable**     | External mail productization                    |
| T207 | Hosting/ops                | **Deferrable**     | CDN/analytics brand wiring                      |
| T208 | `SR-002-004-MODE`          | **Out of 002**     | Commerce connector — do not create              |

---

## 3. Usage assumptions (state explicitly)

Used for low / medium / high monthly cost bands. Change these and costs scale roughly linearly.

| Scenario                    | Brands active | Pages fetched / brand / month | Analysis jobs / month | Notes          |
| --------------------------- | ------------- | ----------------------------- | --------------------- | -------------- |
| **Low (small launch)**      | 50            | ~20 (≈1k pages)               | ~100                  | Pilot agency   |
| **Medium (growing agency)** | 300           | ~60 (≈18k pages)              | ~1,200                | Multi-client   |
| **High (high-volume)**      | 2,000         | ~160 (≈320k pages)            | ~16,000               | Platform scale |

**AI token assumption per analysis job (evidence-grounded structured proposal):** ≈ **8k input + 2k output** tokens (excerpts + schema; not full site mirrors). Recalculate if prompts grow.

**Currency:** USD. Prices change; re-check cited official pages before signing contracts.

---

## 4. Decision: Live website crawl (DEC-004-scoped)

### Decision question

Which **live public-HTTPS** ingestion mechanism should OMA authorize for Phase BG behind `WebsiteConnectorPort`, while keeping commerce out of scope?

### Options

#### C1 — Self-managed public HTTPS connector (existing worker / port)

- Implement production adapter using OMA worker + existing SSRF/robots/redirect safety from Feature 002 domain.
- **No** third-party crawl SaaS for default path.

#### C2 — Managed crawl/extraction: Firecrawl

- Hosted scrape/crawl API mapping into `WebsiteConnectorPort`.
- Credit-based billing; optional JSON extract / ZDR add-ons.

#### C3 — Managed browser infrastructure: Browserbase (+ Fetch API)

- Cloud browsers / Fetch for harder JS sites; higher infra complexity and retention of session artifacts by plan.

### Evidence (official / primary; accessed 2026-09-08)

| Source                                     | URL                                                                                                           | Used for                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| OMA ports / refusing+fixture               | `packages/domain/src/ports/website-connector.port.ts`, `refusing-adapters.ts`, `fixture-website-connector.ts` | Boundary already shipped                       |
| OMA Phase BG tasks                         | `specs/002-brand-website-intelligence/tasks.md` T200–T201                                                     | Unlock map                                     |
| OMA research (future options, not adopted) | `specs/002-brand-website-intelligence/research.md`                                                            | First-party preference noted historically      |
| Firecrawl pricing                          | https://www.firecrawl.dev/pricing                                                                             | Plan $ / credits / concurrency / DPA / ZDR     |
| Firecrawl billing docs                     | https://docs.firecrawl.dev/billing                                                                            | Credit costs, ZDR +1 credit/page, charge rules |
| Browserbase pricing                        | https://www.browserbase.com/pricing                                                                           | Plan $ / Fetch overages                        |
| Browserbase plans docs                     | https://docs.browserbase.com/account/billing/plans                                                            | Hours, proxy, retention, DPA/HIPAA on Scale    |

**Uncertainty:** Firecrawl/Browserbase plan quotas and overage rates can change; Enterprise ZDR/DPA often sales-gated. Anti-bot success rates are workload-dependent (not guaranteed by docs).

### Comparison (Owner view)

| Criterion                  | C1 Self-managed                                         | C2 Firecrawl                                                                       | C3 Browserbase                                               |
| -------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| SSRF responsibility        | **OMA** (already designed)                              | Shared — vendor egress; OMA must still validate URL allowlist before call          | Shared — browser egress; OMA must still gate targets         |
| Robots / public-only       | OMA enforces                                            | Vendor claims robots respect for crawl agent; OMA must still record connector mode | OMA policy + vendor session controls                         |
| Data residency / retention | Pages stay in OMA process memory → excerpts in Postgres | Scraped content handling per plan; **ZDR Enterprise / +1 credit**                  | Session retention **7–30+ days** by plan; DPA/HIPAA on Scale |
| DPA                        | N/A (no crawl SaaS)                                     | Standard DPA from Standard plan upward (pricing page)                              | DPA on Scale (docs)                                          |
| JS-heavy sites             | Harder (HTTP-first)                                     | Stronger managed rendering                                                         | Strongest browser-agent fit                                  |
| Lock-in                    | Low (port stays)                                        | Medium (API semantics/credits)                                                     | Medium–high (browser hours + Fetch)                          |
| Ops burden                 | Higher eng (proxies, retries, observability)            | Lower eng, vendor ops                                                              | Medium–high                                                  |
| Recurring cost             | Mostly infra CPU/egress (IMKAN hosting)                 | Credit plans $0–$749+/mo                                                           | $0 / $20 / $99 / custom + overages                           |

### Cost scenarios (crawl recurring)

**C1 Self-managed:** No per-page SaaS fee. Recurring ≈ worker CPU + egress on IMKAN hosting (**quote required** from hosting owner). One-time: eng to harden live adapter (est. **1–3 engineer-weeks** after Owner approval — complexity only, not a vendor quote).

**C2 Firecrawl (base scrape/crawl = 1 credit/page; no JSON extract add-on):**

| Scenario      | Pages/mo | Fit                                              | Est. monthly plan (list)                 |
| ------------- | -------- | ------------------------------------------------ | ---------------------------------------- |
| Low (~1k)     | 1,000    | Free 1k credits or Hobby $19                     | **$0–$19**                               |
| Medium (~18k) | 18,000   | Hobby insufficient → Standard $99 (100k credits) | **~$99** (+ pay-as-you-go cap if needed) |
| High (~320k)  | 320,000  | Growth $399 (500k) or Scale $749                 | **~$399–$749+**                          |

JSON format (+4 credits/page) multiplies cost ~5× — **avoid for OMA** (OMA already extracts with own heuristics/AI). ZDR +1 credit/page if required.

**C3 Browserbase (Fetch-oriented estimate):**

| Scenario | Approx Fetch calls | Fit                                                     | Est. monthly       |
| -------- | ------------------ | ------------------------------------------------------- | ------------------ |
| Low      | ~1k                | Free/Developer                                          | **$0–$20**         |
| Medium   | ~18k               | Startup $99 (10k included) + overage ~8k × $0.5/1k ≈ $4 | **~$99–$120**      |
| High     | ~320k              | Scale **custom quote**                                  | **Quote required** |

Browser-hour path is usually more expensive than Fetch for simple public pages.

### Security / privacy impact

- C1: Attack surface is OMA egress; must keep SSRF private-IP blocks, redirect limits, timeouts, size caps (already in 002 security tests).
- C2/C3: Third parties see target URLs and page content; require DPA; prefer ZDR for client-sensitive brands; never send non-public URLs.
- Kill switches: env disable live connector; per-tenant crawl budget; global `RATE_LIMIT` / spend caps.

### Implementation impact (after Owner approval only)

- Still **only** through `WebsiteConnectorPort` — no domain rewrite.
- Fixture remains test/review; refusing remains safe default when unset.
- Connector mode recorded on scan (already FR-BWI-019a).

### Tasks unlocked

**T200, T201** (not T208).

### RECOMMENDATION — NOT YET APPROVED

**Choose C1 for default live crawl.** Optionally authorize C2 as a **named fallback adapter** later if public sites routinely fail HTTP fetch — not required to start T200.

### Exact Owner choice required

Pick **one** primary:

- [ ] **C1** Self-managed public HTTPS
- [ ] **C2** Firecrawl managed crawl
- [ ] **C3** Browserbase managed browser/Fetch
- [ ] **Defer live crawl** (keep fixture/refusing; T200–T201 stay blocked)

Also confirm:

- [ ] Commerce remains **out of 002** (affirm T208 out)
- [ ] Monthly crawl spend cap: $____ (hard kill)
- [ ] ZDR/DPA required for managed option? **Yes / No / N/A**

---

## 5. Decision: Live AI provider & policy (DEC-007)

### Decision question

Which AI provider/model policy should OMA authorize for **evidence-grounded Brand Intelligence proposals** (EN+AR, structured JSON, human approve) behind `AiProviderPort`?

### Options

#### A1 — OpenAI API (GPT-4o / later structured-output-capable models)

#### A2 — Anthropic Claude API (Sonnet 5 class default; Haiku for cheap drafts)

#### A3 — Google Gemini via **Vertex AI** (Flash/Pro with JSON schema; residency via GCP region)

### Evidence (official / primary; accessed 2026-09-08)

| Source                              | URL                                                                                                | Used for                                                                              |
| ----------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| OMA `AiProviderPort`                | `packages/domain/src/ports/ai-provider.port.ts`, `refusing-adapters.ts`                            | Boundary                                                                              |
| OMA tasks T202–T203                 | `tasks.md`                                                                                         | Unlock map                                                                            |
| OpenAI Structured Outputs           | https://developers.openai.com/api/docs/guides/structured-outputs                                   | JSON schema adherence                                                                 |
| OpenAI data controls                | https://developers.openai.com/api/docs/guides/your-data                                            | Default no training; 30-day abuse logs; ZDR sales-gated                               |
| OpenAI business privacy / residency | https://openai.com/business-data/ ; https://openai.com/index/introducing-data-residency-in-europe/ | Residency / ZDR eligibility                                                           |
| Anthropic structured outputs        | https://platform.claude.com/docs/en/build-with-claude/structured-outputs                           | JSON schema outputs                                                                   |
| Anthropic API retention / ZDR       | https://platform.claude.com/docs/en/manage-claude/api-and-data-retention                           | ZDR sales enablement; schema cache note                                               |
| Anthropic pricing                   | https://platform.claude.com/docs/en/about-claude/pricing                                           | Sonnet 5 **$2 / $10 per MTok** input/output (standard as of research date)            |
| Gemini structured output            | https://ai.google.dev/gemini-api/docs/structured-output                                            | JSON schema support                                                                   |
| Gemini pricing page                 | https://ai.google.dev/gemini-api/docs/pricing                                                      | **Re-check live rates** (page is dynamic; do not freeze stale Flash/Pro numbers here) |

**Uncertainty:** OpenAI list $/MTok for the exact production model snapshot must be confirmed on https://openai.com/api/pricing/ at contract time (fetch intermittently timed out during research). Gemini Developer API vs Vertex pricing and regional uplift must be confirmed in GCP console/quote. Arabic quality is strong on modern frontier models but **must be validated on OMA fixtures** after selection — not proven by marketing.

### Comparison

| Criterion                   | A1 OpenAI                                      | A2 Anthropic                                                 | A3 Gemini + Vertex                               |
| --------------------------- | ---------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------ |
| Structured JSON             | Official Structured Outputs                    | Official structured outputs (GA on recent Sonnet/Opus/Haiku) | Official JSON schema / mime type                 |
| EN + AR                     | Strong multilingual                            | Strong multilingual                                          | Strong multilingual                              |
| Evidence-grounded proposals | Port must send excerpts only                   | Same                                                         | Same                                             |
| Retention default           | Abuse logs ≤30 days unless ZDR                 | Commercial policy; **ZDR via sales**                         | GCP controls / Vertex governance                 |
| ZDR                         | Enterprise approval                            | Org enablement via account team                              | Vertex/org controls (configure)                  |
| Residency                   | Eligible enterprise regions; EU project option | `inference_geo` / partner clouds (Bedrock/Foundry)           | **GCP region selection** (strong enterprise fit) |
| DPA / BAA                   | Enterprise paths                               | Enterprise paths                                             | GCP DPA / BAA paths                              |
| Lock-in                     | Medium                                         | Medium                                                       | Medium (GCP gravity)                             |
| Cost predictability         | Token meters + caps                            | Token meters + caps; Sonnet 5 published $2/$10               | Often lower Flash tier — verify                  |
| Fallback                    | Refusing + manual (mandatory)                  | Same                                                         | Same                                             |

### Cost scenarios (AI recurring only)

Using **8k in + 2k out** tokens/job:

**Anthropic Claude Sonnet 5** at **$2 / MTok in + $10 / MTok out** (official pricing page, 2026-09-08):

| Scenario       | Jobs/mo | Est. token cost                          |
| -------------- | ------- | ---------------------------------------- |
| Low (100)      | 100     | 100 × ((8k×$2)+(2k×$10))/1e6 ≈ **$3.60** |
| Medium (1,200) | 1,200   | ≈ **$43**                                |
| High (16,000)  | 16,000  | ≈ **$576**                               |

**Haiku 4.5** ($1 / $5 MTok) would be ~half for draft-only paths — quality tradeoff.

**OpenAI:** same token formula once Owner locks model price from official pricing page; expect same order of magnitude for GPT-4o-class unless batch/cache discounts apply.

**Gemini Flash (Vertex):** often materially cheaper for high volume — **do not fabricate**; require GCP quote / current pricing table before high-volume commitment.

**One-time implementation (any AI option):** adapter + config policy + budget meter + eval fixtures — est. **1–2 engineer-weeks** after DEC-007 closes (complexity, not vendor fee).

### Security / privacy impact

- Send **excerpts + schema only** — never full site mirrors (aligns with open DEC-003).
- No training on API data by default (OpenAI docs; confirm Anthropic/Google contract language).
- Prefer ZDR if client brand content is sensitive; note structured-output schema caching nuances (Anthropic: schema cache up to 24h; no PHI in schema property names).
- Hard budget: monthly USD cap, per-tenant cap, kill switch env, refuse when over budget (T203).

### Implementation impact

- Live adapter only behind `AiProviderPort`; refusing remains default when unset.
- AI remains proposal with provenance; humans approve (constitution).
- No Feature 003; no WorkDrive byte duplication.

### Tasks unlocked

**T202, T203**.

### RECOMMENDATION — NOT YET APPROVED

**Choose A2 (Anthropic Sonnet 5 default)** with Haiku optional for cheap drafts, ZDR if sales-available, monthly hard cap, and refusing/manual fallback always on. Revisit A3 if GCP residency is mandatory for IMKAN.

### Exact Owner choice required

Pick **one** primary provider:

- [ ] **A1** OpenAI
- [ ] **A2** Anthropic
- [ ] **A3** Gemini on Vertex AI
- [ ] **Defer live AI** (manual/refusing only; T202–T203 stay blocked)

Policy fields (required if not deferred):

- Default model id: ____________________
- Processing region / residency: ____________________
- Retention: **Default abuse monitoring** / **ZDR** / **Other: ____**
- Monthly AI spend hard cap: $____
- Fallback when over budget or outage: **refusing + manual** (required)
- DPA signed before production traffic: **Yes / Pending**

---

## 6. Combined monthly cost bands (illustrative)

Assumes **C1 self-managed crawl** (SaaS $0) + **A2 Sonnet 5** token costs above. Hosting for C1 **not included** (quote).

| Scenario | Crawl SaaS | AI tokens (Sonnet 5) | Combined SaaS+AI    |
| -------- | ---------- | -------------------- | ------------------- |
| Low      | $0         | ~$4                  | **~$4 + hosting**   |
| Medium   | $0         | ~$43                 | **~$43 + hosting**  |
| High     | $0         | ~$576                | **~$576 + hosting** |

If Owner picks **C2 Firecrawl** instead of C1:

| Scenario | Crawl       | AI    | Combined          |
| -------- | ----------- | ----- | ----------------- |
| Low      | $0–$19      | ~$4   | **~$4–$23**       |
| Medium   | ~$99        | ~$43  | **~$142**         |
| High     | ~$399–$749+ | ~$576 | **~$975–$1,325+** |

**Hard budget controls (required in DEC-007 / crawl auth):** per-env kill switch, monthly USD cap, pay-as-you-go off or capped, connector mode disclosure, alert at 80% budget.

**Migration / fallback:** Port adapters allow swapping C1↔C2 or A1↔A2↔A3 without domain rewrite; fixture/refusing always available for demos and outages.

---

## 7. What may remain deferred

| Item                                                | Why deferrable                                  |
| --------------------------------------------------- | ----------------------------------------------- |
| DEC-003 / T204–T205                                 | Excerpts already approve profiles               |
| T206–T207                                           | Not crawl/AI                                    |
| T208 / commerce                                     | Permanently out of 002                          |
| DEC-005, 006, 010, 011                              | Outside Brand Website Intelligence live path    |
| DEC-008, 009, 012                                   | Interim 002 boundaries already operate          |
| Full “both crawl+commerce” answer to global DEC-004 | Not needed to authorize public-HTTPS live fetch |

---

## 8. Privacy / residency warnings

1. **Managed crawl vendors see page content and URLs** — require DPA; prefer ZDR for sensitive clients; Enterprise-only for Firecrawl ZDR.
2. **AI providers retain abuse-monitoring content by default (commonly ~30 days)** unless ZDR approved — treat Brand Intelligence excerpts as potentially confidential.
3. **Data residency is rarely free self-serve** — OpenAI/Anthropic enterprise or GCP region selection may be required for UAE/EU constraints; confirm IMKAN legal posture before production.
4. **Do not put secrets, tenant credentials, or private intranet URLs** into crawl or AI payloads.
5. **Arabic/EN quality** must be validated on OMA fixtures post-selection; packet does not claim measured parity.

---

## 9. Official sources summary

| Topic                    | Primary sources (accessed 2026-09-08)                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Crawl SaaS plans         | firecrawl.dev/pricing ; docs.firecrawl.dev/billing                                                                                                           |
| Browser infra            | browserbase.com/pricing ; docs.browserbase.com/account/billing/plans                                                                                         |
| AI structured output     | developers.openai.com/api/docs/guides/structured-outputs ; platform.claude.com/docs/.../structured-outputs ; ai.google.dev/gemini-api/docs/structured-output |
| AI retention / residency | developers.openai.com/api/docs/guides/your-data ; openai.com/business-data ; platform.claude.com/docs/.../api-and-data-retention                             |
| AI pricing               | platform.claude.com/docs/en/about-claude/pricing ; ai.google.dev/gemini-api/docs/pricing (re-check); openai.com/api/pricing (re-check)                       |
| OMA gates                | Foundation spec §17; Feature 002 plan/tasks/research/contracts                                                                                               |

---

## 10. Owner decision checklist (submit once)

1. Crawl primary: **C1 / C2 / C3 / Defer**
2. Crawl monthly hard cap: $____
3. AI primary: **A1 / A2 / A3 / Defer**
4. AI model + region + retention + monthly hard cap
5. Affirm: **no commerce in 002**, **DEC-003 deferred**, **T204–T208 not started by this packet**
6. Authorize implement stage only after written Owner approval: next stage name **`OWNER_DECISION_PHASE_BG_002`** → then gated implement for unlocked tasks only

---

## Traceability

| Artifact                          | Role                                                       |
| --------------------------------- | ---------------------------------------------------------- |
| This packet                       | Owner decision input                                       |
| `tasks.md` Phase BG               | Task unlocks                                               |
| `contracts/ingestion-ai-ports.md` | Port contracts                                             |
| `closeout.md`                     | Accepted provider-neutral core remains ACCEPTED            |
| Foundation `spec.md` §17          | DEC registry (decisions stay open until Owner closes them) |

**Next stage (do not start here):** `OWNER_DECISION_PHASE_BG_002`
