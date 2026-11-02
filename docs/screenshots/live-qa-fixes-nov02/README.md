# Live QA fixes — 2026-11-02

UI evidence for PR `fix/live-qa-issues-nov02` (EN + AR):

| File | What it shows |
|------|----------------|
| `compose-media-warnings-en.png` / `-ar.png` | Pre-publish per-network media validation warnings in compose |
| `publish-queued-stale-en.png` / `-ar.png` | Stale QUEUED state when the worker is not picking jobs |
| `auth-dir-ltr-en.png` / `auth-dir-rtl-ar.png` | Auth pages now set `dir` from locale (hydration #418 fix) |

Fixtures mirror the Planable-style copy shipped in the web app; live retest happens after API + worker deploy.
