# OpenAI text offline certification

**Stage:** `CERTIFY_OMA_OPENAI_TEXT_INTELLIGENCE_OFFLINE_READY`  
**Starting SHA:** `ed7ef5f4194819107d82a3d64b91d5d459f55e41`  
**Result:** `NOT_PASS`

Live OpenAI was not called. `AI_LIVE_ENABLED` stayed false. `pnpm ai:openai:smoke` exits 1.

## Proven

| Check                                      | Result                                                            |
| ------------------------------------------ | ----------------------------------------------------------------- |
| Adapter behind `AiProviderPort`            | Present. Live path is not used while disabled.                    |
| No browser/OpenAI call in the offline path | `completeStructured` returns `AI_DISABLED` before the SDK import. |
| Smoke command refuses                      | Exit 1, no request.                                               |
| `.env` ignored and untracked               | Yes. No secret printed.                                           |
| Model router Luna/Terra                    | Unit tested. Models are not live-verified.                        |
| Schema validation                          | Unit tested.                                                      |
| Deterministic test adapter                 | Unit tested. Forbidden in production and when live is on.         |
| Budget warn / daily cap / release          | Unit tested on the ledger helper.                                 |
| Settings copy                              | Static EN/AR billing-required note.                               |

## Not proven — do not mark PASS

| Gap                                          | Why                                                            |
| -------------------------------------------- | -------------------------------------------------------------- |
| Visible Brand/Strategy Playwright journeys   | Not executed.                                                  |
| Generating → proposal → edit → accept UI     | No review screen wired to evidence.                            |
| Worker membership/capability reauthorization | Not implemented.                                               |
| Audit/outbox/metrics for AI runs             | Not written.                                                   |
| OpenAPI sync for `/api/v1/ai/*`              | Not regenerated in this certification.                         |
| Clean-database migration execution           | Schema and SQL exist; a fresh database apply was not run here. |
| Accept-into-draft against a real Brand row   | Code path exists; no database integration test ran.            |

`TEST_ADAPTER_VISIBLE_JOURNEYS` stays unverified. Owner acceptance is not claimed.
