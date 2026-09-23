# DEC-007 — OpenAI text selected, activation pending billing

**Status:** `OPENAI_TEXT_SELECTED_ACTIVATION_PENDING_BILLING`  
**Date:** 2026-09-23

OpenAI is the first text-intelligence provider behind `AiProviderPort`.

- `OpenAiProviderAdapter` is the only OpenAI SDK boundary.
- `refusingAiProvider` remains the fallback when the adapter is not selected.
- Live calls stay off until a separate billing authorization (`AI_LIVE_ENABLED=false`).
- Model IDs `gpt-5.6-luna` and `gpt-5.6-terra` are configured and **not live-verified**.
- No image, video, audio, speech, or realtime APIs.
- This decision does not close crawl, ads, publishing, storage, or other provider decisions.

# DEC-016 addendum

`DEC-016` still defers live third-party product integrations. Building this **disabled** text adapter is allowed. It does not authorize live OpenAI traffic and does not close `DEC-003`–`DEC-006` or `DEC-008`–`DEC-012`.
