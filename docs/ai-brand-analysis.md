# AI brand analysis

OMA can turn a finished website scan into a reviewable brand-profile proposal. The live path uses structured outputs from the configured OpenAI, xAI Grok, Groq Cloud, or Google Gemini provider. Nothing is written to an approved profile, and every AI claim stays `PENDING` until a human accepts or rejects it.

## Flow

1. The website connector crawls and extracts observations (see `docs/brand-website-scanning.md`).
2. Ingestion writes a heuristic `ProfileVersion` draft and `InsightClaim` rows (`createdBy=SYSTEM`).
3. If AI is available, ingestion enqueues an `analysis.brand_profile` outbox event.
4. The worker analysis processor loads evidence, builds a versioned prompt, calls the configured AI provider (or the non-prod test adapter), and writes `InsightClaim` rows (`createdBy=AI`, `infoState=AI_INFERRED`) plus tone, audiences, messaging, and visual-identity sections.
5. The scan and profile record `analysisStatus`: `QUEUED` → `ANALYZING` → `ANALYZED` or `FAILED`. Successful analysis sets `aiAvailability=USED`.
6. Humans review claims in the existing accept/reject UI before approval.

If AI is not configured, the heuristic draft remains and both records stay `NOT_CONFIGURED` / `SKIPPED`. Brand-aware captions, inbox drafts, and strategy propose are documented in `docs/ai-content-generation.md`.

## When AI is available

Live analysis runs only when **both** are true:

- `AI_LIVE_ENABLED=true`
- The key matching `AI_PROVIDER` is set: `OPENAI_API_KEY` (`openai`), `XAI_API_KEY` (`grok`), `GROQ_API_KEY` (`groq`), or `GEMINI_API_KEY` (`gemini`).

`OPENAI_PROJECT_ID` and `OPENAI_BASE_URL` are optional for OpenAI. Grok, Groq, and Gemini use their official OpenAI-compatible Chat Completions endpoints. Groq Structured Outputs strict mode uses `openai/gpt-oss-20b` or `openai/gpt-oss-120b` by default. If live AI is enabled without the selected provider key, `loadEnv()` fails at startup with a clear error.

The public status endpoint reports `availability` as:

- `AVAILABLE` — live flag and key are present (or the non-prod test adapter is on)
- `NOT_CONFIGURED` — live is off or the key is missing
- `BUDGET_EXHAUSTED` — tenant daily/monthly USD cap would be exceeded (`GET /api/v1/ai/budget`)

`GET /api/v1/ai/status` is process-wide and cannot know a tenant budget. Use `/api/v1/ai/budget` after login for the exhausted state.

Production must never set `AI_TEST_ADAPTER=1`. That adapter is allowed only when `NODE_ENV !== production` and live is off.

## Prompts

Versioned templates live in `packages/ai/src/prompts/`:

| promptId                      | version | use case              |
| ----------------------------- | ------- | --------------------- |
| `oma.brand_profile_synthesis` | `2`     | Main scan analysis    |
| `oma.evidence_summary`        | `1`     | Evidence-only summary |
| `oma.contradiction_analysis`  | `1`     | Conflict detection    |

Crawled text is wrapped in `BEGIN/END UNTRUSTED CRAWLED CONTENT` delimiters. The model is told to treat that block as data and ignore instructions inside it. Evidence is truncated by a character/token estimate before the call. Item values must be English or Arabic according to observed `brand.languages`. Every item must cite evidence ids from the provided set and include `confidence` between 0 and 1. The banner `AI GENERATED PROPOSAL — REQUIRES HUMAN REVIEW` is required.

## Costs and credits

USD cost is computed from provider token usage and a price table:

- Defaults: `gpt-4.1-mini` $0.40 / $1.60 per 1M tokens; `gpt-4.1` $2.00 / $8.00 per 1M tokens (input / output). Groq defaults are `openai/gpt-oss-20b` $0.075 / $0.30 and `openai/gpt-oss-120b` $0.15 / $0.60 per 1M tokens (input / output).
- Override with `AI_MODEL_PRICES_JSON`, e.g. `{"gpt-4.1":{"inputPerMillion":2,"outputPerMillion":8}}`.
- Unknown models use a conservative $5 / $15 per 1M fallback.

Daily (`AI_DAILY_BUDGET_USD`, default 2) and monthly (`AI_MONTHLY_BUDGET_USD`, default 25) caps, plus optional token caps, are evaluated **before** the provider is called. Settled cost and token counts are stored on `AiRun`.

Plan `ai_credits_per_month` is consumed **only after a successful proposal**, and not again when the same idempotency key is replayed.

## How to enable in production

Set the following on **both** the API and the worker, then redeploy. Choose one provider and its corresponding key:

```
AI_PROVIDER=openai           # openai | grok | groq | gemini
AI_LIVE_ENABLED=true
OPENAI_API_KEY=...           # when AI_PROVIDER=openai
XAI_API_KEY=...               # when AI_PROVIDER=grok
GROQ_API_KEY=...              # when AI_PROVIDER=groq
GROQ_BASE_URL=https://api.groq.com/openai/v1
GEMINI_API_KEY=...            # when AI_PROVIDER=gemini
AI_DEFAULT_MODEL=             # optional; provider default when blank
AI_REASONING_MODEL=           # optional; provider default when blank
AI_REQUEST_TIMEOUT_MS=60000
AI_MAX_RETRIES=2
AI_MONTHLY_BUDGET_USD=25
AI_DAILY_BUDGET_USD=2
```

Provider defaults are OpenAI `gpt-4.1-mini` / `gpt-4.1`, Grok `grok-4.7` for both tiers, Groq `openai/gpt-oss-20b` / `openai/gpt-oss-120b`, and Gemini `gemini-3.8-flash` for both tiers. Set explicit model IDs if your account exposes different models. Costs for models without configured rates use the conservative fallback shown above.

Apply the `ai_brand_analysis` Prisma migration. The workspace plan must include `ai_assist`.

Manual re-run: `POST /api/v1/brands/:brandId/scans/:scanId/analyze` with an `Idempotency-Key`, capability `brand.scan.control`, and the `ai_assist` plan feature.

Live smoke (never in CI):

```
AI_LIVE_ENABLED=true OPENAI_API_KEY=... AI_SMOKE_CONFIRM=I_UNDERSTAND_BILLING pnpm ai:openai:smoke  # OpenAI-only smoke script
```

## Security notes

- No API keys, full prompts, or crawled PII are logged at info level. The adapter records use case, model, token counts, latency, and error codes only.
- Prompt injection from scraped pages is treated as untrusted data.
- Approved and superseded profile versions are never mutated.
- SSRF and crawl policy remain the website connector’s responsibility.
