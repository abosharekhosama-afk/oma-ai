# AI content generation, inbox drafts, and strategy propose

Brand-aware text generation sits on top of website scanning and brand analysis (`docs/ai-brand-analysis.md`, `docs/brand-website-scanning.md`). Nothing is published or sent automatically. Every live result is a reviewable proposal.

## Flow

1. `BrandContext` is built from the brand’s latest **APPROVED** `ProfileVersion` (pointer `currentApprovedProfileVersionId`, falling back to the newest approved row). Tenant and brand ids are always required.
2. The compact context includes overview, tone, audiences, messaging, products/services, languages, visual identity, accepted (“do”) claims, rejected (“don’t”) claims, and banned words. It is token-budgeted (default ~1200 tokens) and cached per approved version. Approval invalidates the cache.
3. If no approved profile exists, generation still runs using the brand name only and sets `used_approved_profile=false` so the UI can say so honestly.
4. Composer, inbox, and strategy endpoints inject that context into versioned prompts and call the selected provider's structured-output API (or the non-prod test adapter). Credits and USD budget are reserved first; plan credits are consumed only after a successful proposal. Replaying the same idempotency key does not charge again.

## Prompts

| promptId                 | version | use case               |
| ------------------------ | ------- | ---------------------- |
| `oma.caption_generation` | `1`     | New captions           |
| `oma.caption_rewrite`    | `1`     | Tone/length rewrites   |
| `oma.alt_text`           | `1`     | Image alternative text |
| `oma.content_ideas`      | `1`     | Post ideas             |
| `oma.hashtag_suggestion` | `1`     | Hashtag sets           |
| `oma.inbox_reply`        | `1`     | Inbox reply drafts     |
| `oma.strategy_propose`   | `1`     | Strategy section draft |

User captions/titles are wrapped in `BEGIN/END UNTRUSTED USER INPUT`. Inbox threads use `BEGIN/END UNTRUSTED CUSTOMER CONVERSATION`. Strategy draft JSON uses `BEGIN/END UNTRUSTED STRATEGY DRAFT INPUT`. Models are told to treat those blocks as data.

Platform limits are enforced in the prompt and again after decoding:

- Instagram 2200 / ~12 hashtags
- Facebook long-form / few hashtags
- X/Twitter 280 / 2–3 hashtags
- TikTok 2200 / few hashtags
- LinkedIn 3000 / 3–5 hashtags
- YouTube, Threads, WhatsApp, Pinterest have their own caps

Arabic output is Modern Standard Arabic and intended for RTL display.

## Endpoints

- `POST /api/v1/brands/:brandId/ai/generate` (`kind=caption|rewrite|alt|idea|hashtags`)
- Aliases: `/ai/captions`, `/ai/captions/rewrite`, `/ai/alt-text`, `/ai/ideas`, `/ai/hashtags`
- `POST /api/v1/inbox/conversations/:id/ai/draft` — never auto-sends (`auto_sent: false`)
- `POST /api/v1/brands/:brandId/strategies/:strategyId/versions/:versionId/ai/propose`
- `POST .../ai/propose/accept` and `.../ai/propose/reject` (draft versions only)

Send an `Idempotency-Key` header. Capability: `content.create` for composer generation, `content.update` for inbox drafts, `strategy.edit` for strategy propose. Plan feature `ai_assist` is required when AI runs.

When AI is not configured the API returns **503** `AI_NOT_CONFIGURED` with `fallback: "template"`. The web composer and inbox fall back to the existing local templates and label them as templates, not live AI. Budget exhaustion is **429** `BUDGET_EXCEEDED`. A missing plan feature is **402** `PLAN_FEATURE_REQUIRED`.

## Strategy propose

`STRATEGY_AI_MODE=live` (default) proposes when AI is available. `refuse` or `not_configured` always return 503. Approved and superseded strategy versions are never mutated. Accept applies empty-field fills on a **DRAFT** only (positioning, goals, key messages, organic/paid empty slots). Reject records the decision on the `AiRun` and leaves the draft unchanged.

## Observability and safety

Each `AiRun` stores `promptId`, `promptVersion`, model, token counts, settled USD cost, and `metadataJson` (including `brandProfileVersionId`). Logs at info level do not include prompts, customer messages, or other PII. Generated text is checked against banned words and rejected claims.

Inbox sentiment classification remains the existing keyword/regex helper. Live AI sentiment is not enabled (`AI_SENTIMENT_ENABLED` is reserved and unused) because a second model call per inbound message is not justified yet.

## Environment

Same live gate as brand analysis, plus:

```
STRATEGY_AI_MODE=live
AI_LIVE_ENABLED=true
AI_PROVIDER=openai           # openai | grok | groq | gemini
OPENAI_API_KEY=...           # or XAI_API_KEY / GROQ_API_KEY / GEMINI_API_KEY for selected provider
GROQ_BASE_URL=https://api.groq.com/openai/v1  # when AI_PROVIDER=groq
AI_DEFAULT_MODEL=             # optional, defaults follow AI_PROVIDER
AI_REASONING_MODEL=           # optional, defaults follow AI_PROVIDER
AI_MONTHLY_BUDGET_USD=25
AI_DAILY_BUDGET_USD=2
```

Set these on the API (and the worker if analysis also runs there). Never set `AI_TEST_ADAPTER=1` in production.

## Costs

Composer and inbox drafts use the default (Luna) model. Strategy propose uses the routed Terra/reasoning model. USD cost uses the same price table as brand analysis. Unknown models fall back to the conservative $5 / $15 per 1M rates.
