# Local infrastructure

Preferred local runtime for this machine: Homebrew `postgresql@16` + `redis`.

Optional Compose (requires Docker):

```bash
docker compose -f infra/docker-compose.yml up -d
```

## Bootstrap Platform Owner

```bash
pnpm --filter @oma/api bootstrap:platform-owner
```

Uses `BOOTSTRAP_PLATFORM_OWNER_EMAIL` and `BOOTSTRAP_PLATFORM_OWNER_PASSWORD` from the environment. Never self-serve.
