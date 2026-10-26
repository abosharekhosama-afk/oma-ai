# Social accounts: setup

Brands connect their own Facebook Pages, Instagram professional accounts, LinkedIn,
TikTok and X accounts from **Brand → Settings → Accounts**. A network appears as
"Not available yet" until its keys below are set on **both** the API and the worker
services. No network is ever faked.

## Shared (required for any network)

| Variable | Where | Value |
| --- | --- | --- |
| `SOCIAL_TOKEN_ENCRYPTION_KEY` | API + worker (same value) | 32 random bytes, base64 or hex. Generate: `openssl rand -base64 32`. Tokens are stored AES-256-GCM encrypted with it. Rotating it disconnects every account (they must reconnect). |
| `SOCIAL_OAUTH_REDIRECT_BASE` | API | Public origin used to build the callback URL. Set to `https://oma-ai-ecru.vercel.app`. Falls back to `WEB_BASE_URL`, then `API_PUBLIC_URL`. |
| `SOCIAL_PUBLISH_INTERVAL_MS` | worker (optional) | How often due posts are published. Default `60000`. |
| `SOCIAL_REFRESH_INTERVAL_MS` | worker (optional) | How often tokens are refreshed/validated. Default `900000`. |

## Redirect (callback) URLs

The web app proxies `/api/*` to the Render API, so the callback goes through the
Vercel origin and keeps the signed-in session cookie first-party. Register exactly:

| Network | Redirect URL |
| --- | --- |
| Facebook + Instagram (one Meta app) | `https://oma-ai-ecru.vercel.app/api/v1/social/oauth/facebook/callback` and `https://oma-ai-ecru.vercel.app/api/v1/social/oauth/instagram/callback` |
| LinkedIn | `https://oma-ai-ecru.vercel.app/api/v1/social/oauth/linkedin/callback` |
| TikTok | `https://oma-ai-ecru.vercel.app/api/v1/social/oauth/tiktok/callback` |
| X | `https://oma-ai-ecru.vercel.app/api/v1/social/oauth/x/callback` |

If you instead point `SOCIAL_OAUTH_REDIRECT_BASE` at the Render API directly, the
URLs become `<API_PUBLIC_URL>/api/v1/social/oauth/<network>/callback`; that only
works when the session cookie is valid on that host, so the Vercel origin is preferred.
For local development use `http://localhost:3000/api/v1/social/oauth/<network>/callback`.

## Meta (Facebook Pages + Instagram)

| Variable | Value |
| --- | --- |
| `META_APP_ID` | App ID from developers.facebook.com → your app → Settings → Basic |
| `META_APP_SECRET` | App secret from the same page |
| `META_GRAPH_VERSION` | Optional, default `v21.0` |

App setup: add **Facebook Login for Business**; add both redirect URLs above to
"Valid OAuth Redirect URIs". Permissions requested — Facebook: `pages_show_list`, `pages_read_engagement`,
`pages_manage_posts`; Instagram: `pages_show_list`, `pages_read_engagement`,
`business_management`, `instagram_basic`, `instagram_content_publish`. Outside development mode these need
Meta App Review. Instagram must be a professional account linked to a Facebook Page,
and Instagram posts need an image (the post preview image URL must be public).

## LinkedIn

| Variable | Value |
| --- | --- |
| `LINKEDIN_CLIENT_ID` | From linkedin.com/developers → app → Auth |
| `LINKEDIN_CLIENT_SECRET` | Same page |
| `LINKEDIN_API_VERSION` | Optional, `YYYYMM`, default `202410` |
| `LINKEDIN_ORGANIZATIONS` | Optional, `1` to also connect company pages (needs the Community Management API product) |

Products: **Sign In with LinkedIn using OpenID Connect** and **Share on LinkedIn**.
Scopes: `openid profile w_member_social` (plus `w_organization_social r_organization_admin` when organizations are on).
LinkedIn issues no refresh token on standard apps; tokens last 60 days, then the account shows "Reconnect".

## TikTok

| Variable | Value |
| --- | --- |
| `TIKTOK_CLIENT_KEY` | From developers.tiktok.com → app |
| `TIKTOK_CLIENT_SECRET` | Same page |
| `TIKTOK_PRIVACY_LEVEL` | Optional, default `SELF_ONLY`. Unaudited apps can only post privately; after TikTok's audit set `PUBLIC_TO_EVERYONE`. |

Products: **Login Kit** and **Content Posting API** (Direct Post). Scopes:
`user.info.basic,video.publish`. Photo posts use `PULL_FROM_URL`, so the image's domain
must be verified in the TikTok app. Posts need an image.

## X

| Variable | Value |
| --- | --- |
| `X_CLIENT_ID` | OAuth 2.0 Client ID (developer.x.com → app → Keys and tokens) |
| `X_CLIENT_SECRET` | OAuth 2.0 Client Secret |

App type: **Web App, confidential client**, with OAuth 2.0 enabled and read+write permissions.
Scopes: `tweet.read tweet.write users.read offline.access` (PKCE S256). Posting requires an
X API plan that allows `POST /2/tweets`. Text only.

## How publishing works

1. Pick the account on a post (`POST /api/v1/content/:id/publish-target`) and schedule it.
2. The worker checks every minute for **approved** posts (or any post when the brand's
   approval policy is "none") whose scheduled time has passed.
3. Success stores the post's link; temporary errors retry after 1, 5, 15 and 60 minutes
   (5 attempts max); the last error is shown on the post.
4. An expired or revoked grant marks the account **Reconnect needed** and notifies the brand's managers.
5. Archiving or deleting a brand unschedules its pending posts; deleting also disconnects its accounts.
