# Imkan WorkDrive storage

OMA stores post media, brand logos and deliverables in each workspace's own Imkan WorkDrive (DEC-003). This page covers setup for operators and admins.

## 1. Server environment

| Variable                          | Where       | Purpose                                                                                                                                                                                                                                                                 |
| --------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WORKDRIVE_ENCRYPTION_KEY`        | api, worker | 64 hex chars (`openssl rand -hex 32`). Encrypts stored WorkDrive keys (AES-256-GCM). Falls back to `SOCIAL_TOKEN_ENCRYPTION_KEY`. If neither is set, the storage screen shows "not enabled". **Changing it orphans existing connections, so they must be reconnected.** |
| `WORKDRIVE_DEFAULT_URL`           | api         | Optional. Pre-fills the WorkDrive address, e.g. `https://imkan-workdrive-v1.onrender.com`.                                                                                                                                                                              |
| `WORKDRIVE_MAX_VIDEO_MB`          | api, worker | Max video upload. Default `500`.                                                                                                                                                                                                                                        |
| `WORKDRIVE_MAX_IMAGE_MB`          | api, worker | Max image/document upload. Default `25`.                                                                                                                                                                                                                                |
| `WORKDRIVE_MIGRATION_INTERVAL_MS` | worker      | How often the data-URL logo migration and the missing-file check run. Default `600000` (10 min). The first run is 15 s after start.                                                                                                                                     |
| `WORKDRIVE_ALLOW_PRIVATE_URLS`    | api         | `1` allows private/LAN addresses when `NODE_ENV=production`. Default off. Outside production, `http://localhost` / `127.0.0.1` are allowed for local development.                                                                                                       |

Run the migration `20261026140000_workdrive_media_assets` (`pnpm --filter @oma/db exec prisma migrate deploy`).

## 2. Create an integration key in WorkDrive

In WorkDrive (admin) → Integrations → API keys, create a key for OMA with these scopes:
`files:read`, `files:write`, `folders:read`, `folders:write`. Optionally confine it to a root folder such as `OMA`. Copy the `wdk_…` token; it is shown once.

## 3. Connect in OMA

Settings → Storage (`/app/settings?section=storage`). Workspace admins only (`tenant.manage`).
Enter the WorkDrive address and the key, then choose **Connect**. OMA calls `GET /integration/self` and shows the organisation name, root folder and key prefix. **Test connection** re-checks it. **Disconnect** removes the key, but already-linked media keep their references.

### Connection errors

OMA finds the WorkDrive API on its own. The address can be typed with or without a trailing `/`, `/api` or `/api/v1`. Use the **backend** address (e.g. `https://imkan-workdrive-v1.onrender.com`), not the WorkDrive web app address.

| What happened                                     | Message                                               |
| ------------------------------------------------- | ----------------------------------------------------- |
| The address is a website, not the WorkDrive API   | "This address doesn't lead to WorkDrive…"             |
| The key is invalid, revoked or expired            | "WorkDrive didn't accept this key…"                   |
| The key lacks permission                          | "This key doesn't have permission to connect…"        |
| WorkDrive answers but has no integration keys yet | "This WorkDrive doesn't support app connections yet…" |
| Nothing answers                                   | "We couldn't reach WorkDrive at this address…"        |

## 4. How media flows

- **Upload:** browser → `POST /api/v1/brands/:brandId/media?kind=posts|logos|deliverables&name=…` (raw body). The API streams the body to a temp file while hashing it (never buffering it in memory) and enforces the size limit. It then uploads to WorkDrive: one signed PUT up to 32 MiB, or resumable 16 MiB parts above that.
- **Choose existing:** `GET …/media/browse` and `POST …/media/import` attach a file that already exists in WorkDrive.
- **View:** `GET /api/v1/media/:id/view` returns 302 to a fresh signed preview URL (valid 15 min). `/url` returns it as JSON, and `/stream` proxies with Range support.
- **Publishing:** Instagram/TikTok receive a fresh signed URL at publish time.
- **Missing files:** if WorkDrive returns 404, the asset becomes `MISSING` (410 on view) and the UI warns. The daily check flips it back if the file is restored.
- **Logo migration:** the worker moves existing `data:` logos into `OMA/{brand}/logos/logo-{sha12}.ext`. It is idempotent: it reuses an existing asset or file with the same hash and only switches the brand if its logo did not change meanwhile.

## 5. Limitations

- Uploads through the web app's `/api` proxy are subject to the hosting platform's request-body limit (e.g. Vercel). For large videos, point `NEXT_PUBLIC_API_URL`/the proxy at the API directly.
- Renaming a brand changes the folder slug for **new** uploads; existing files stay where they are.
- The private-address check runs at connect time only (no DNS-rebinding protection).
- TikTok `PULL_FROM_URL` requires the WorkDrive media domain to be verified in the TikTok developer portal.
