# Contract: Strategy Ports (DEC-016)

**Feature**: `003-strategy-organic-paid-plans`
**Status**: `READY_FOR_REVIEW`

---

## AiProviderPort (reuse)

- Production/default: **refusing** / not-configured adapter.
- Strategy `POST .../ai/propose` MUST call port and surface honesty errors — never fabricate proposals.
- No AI SDK, API keys, model selection, or third-party prompts in 003.
- Test doubles allowed **only in tests** at the port boundary.
- Live wiring blocked until final integration + `DEC-007`.

## Explicitly not introduced in 003

| Port / integration                | Status                                   |
| --------------------------------- | ---------------------------------------- |
| Ad platform / Meta                | Not connected; Paid fields planning-only |
| Social publishing                 | Not connected                            |
| External analytics / keyword APIs | Not connected                            |
| Website crawl                     | Not used (Feature 002 owns crawl)        |
| Object storage vendor             | Not required for strategy docs           |

## UI honesty

Surfaces MUST show not-connected/not-configured for AI and deferred paid/social/analytics integrations. Paid budget controls MUST label **Planning budget — not live ad spend**.
