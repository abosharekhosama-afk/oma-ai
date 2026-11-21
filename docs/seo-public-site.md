# Public site SEO (OMA Web)

## What ships in the app

- **`/sitemap.xml`** — indexable public routes only (`/`, `/login`, `/register`, `/privacy`, `/terms`).
- **`/robots.txt`** — allows marketing pages; blocks `/app/`, `/api/`, invite/reset flows.
- **`noindex`** on all `/app/*` (metadata + `X-Robots-Tag` header).
- **JSON-LD** on the landing page (Organization, WebSite, SoftwareApplication).
- **`metadataBase`** + canonical on `/` when indexing is enabled.

## Required production env (Render / Vercel)

Set the **public marketing URL** (not the API host):

```bash
NEXT_PUBLIC_SITE_URL=https://your-marketing-domain.com
# or
WEB_BASE_URL=https://your-marketing-domain.com
```

Indexing is **off** on `localhost` / `127.0.0.1`. To force off on staging:

```bash
OMA_PUBLIC_SEO_INDEX=0
```

## After deploy — owner checklist

1. Open `https://your-domain/robots.txt` and `https://your-domain/sitemap.xml`.
2. In [Google Search Console](https://search.google.com/search-console): add property → verify → submit sitemap URL.
3. Optional: Bing Webmaster Tools — same sitemap.
4. Confirm `WEB_BASE_URL` matches the domain users see (no wrong host in Open Graph).
5. Landing meta copy lives in `packages/i18n` keys `landing.meta.*` (EN/AR).

## What search engines will not index

Tenant workspaces, brands, scans, and all authenticated product UI under `/app/*`.
