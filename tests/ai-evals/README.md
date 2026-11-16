# AI evals (Phase 3, DEC-027)

These evals are deterministic. Each case replays recorded model replies through the
production prompt builders, the per-call v2 contracts, the repair loop
(`runStructuredCore`) and the moderation step. They make no network calls and run in CI
with `pnpm test` (or `pnpm test:ai-evals` on their own).

- `cases.ts` holds the golden cases (every contract, in EN and AR) and the
  prompt-injection cases. A case tagged `known_gap` records a limit of the
  checks on purpose (for example, a poisoned page cited with its own real
  evidence id).
- `harness.ts` builds each call the same way production does, replays the case, and
  computes the metrics: first-pass validity, final validity, repair rate, banned-claim
  leaks, and the injection-blocked rate.
- Bar enforced in CI: final validity 100%, banned leaks 0, injection blocked 100%
  (known gaps excluded), and a repair rate under 50% on the golden set.

To run the live eval (costs money, never in CI):

```bash
AI_LIVE_ENABLED=true AI_PROVIDER=openai OPENAI_API_KEY=… pnpm ai:eval:live -- --out /tmp/ai-eval.json
```

Use `--only <id-substring>` to run a subset of cases. The script prints aggregate
metrics and writes a per-case report.
