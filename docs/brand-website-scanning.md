# Brand website scanning

OMA scans a connected public website through `WebsiteConnectorPort`. There is no third-party crawl vendor. The worker fetches pages, extracts observations, and stores evidence excerpts for human review.

## Connector modes

Set `BRAND_WEBSITE_CONNECTOR` to one of:

| Value      | Behavior                                                                      |
| ---------- | ----------------------------------------------------------------------------- |
| `live`     | First-party HTTP(S) crawler with SSRF protections, robots.txt, sitemaps       |
| `fixture`  | Serves `tests/fixtures/websites/*` (never enabled when `NODE_ENV=production`) |
| `disabled` | Fetches refuse with `WebsiteConnectorNotConfiguredError`                      |

If `BRAND_WEBSITE_CONNECTOR` is unset, the process uses the fixture adapter when `BRAND_FIXTURE_CONNECTOR=1` and `NODE_ENV` is not `production`. Otherwise it uses the live adapter.

Connecting a website always checks URL shape (HTTPS, no credentials, standard port) and hostname SSRF rules. When the live or fixture connector is enabled, OMA also probes the URL (HEAD, then GET if needed) before marking the source `VALID`. Failures return a specific error such as `WEBSITE_UNREACHABLE`, `WEBSITE_NON_HTML`, `WEBSITE_ROBOTS_DISALLOWED`, `WEBSITE_TOO_MANY_REDIRECTS`, `WEBSITE_TLS_ERROR`, or `URL_SSRF_DENIED`.

When the connector is `disabled`, the URL can still be saved so a profile can exist without crawling.

## What the live crawler does

- Resolves DNS, rejects private / loopback / link-local / multicast / reserved IPv4 and IPv6 (including IPv4-mapped IPv6 and `169.254.169.254`), and pins the TLS connection to a validated address to reduce DNS rebinding risk.
- Follows at most `BRAND_SCANNER_MAX_REDIRECTS` hops. Each hop is re-validated. HTTPS is never downgraded to HTTP. Cross-origin redirects are recorded but not followed, except `www` / apex of the same host.
- Enforces connect and total timeouts, streams the body, and aborts past `BRAND_MAX_BYTES`.
- Accepts `text/html` and `application/xhtml+xml` for pages. `robots.txt` and sitemaps use text/XML allowlists.
- Identifies itself with `BRAND_SCANNER_USER_AGENT`, sends `Accept-Language`, and accepts gzip/br.
- Limits per-host concurrency and adds a polite delay. `429` / `503` responses honor `Retry-After` with bounded retries.
- Fetches and parses `robots.txt` (user-agent groups, `Allow` / `Disallow` with `*` and `$`, longest-match with Allow winning ties, `Crawl-delay`, `Sitemap`). A missing file (404) allows crawling; a 5xx response is treated conservatively as disallow (RFC 9309).
- Seeds additional URLs from sitemap indexes and common locations (`/sitemap.xml`, `/wp-sitemap.xml`, …), plus default marketing paths (`/products`, `/services`, `/shop`, …) and optional `BRAND_SCANNER_PATH_SEEDS`.
- Prioritizes catalog-like paths in the crawl queue when link budget is tight.
- Canonicalizes URLs (fragments and tracking parameters such as `utm_*` are stripped) and respects `link rel=canonical` plus `meta robots` `nofollow` when discovering links.
- Extracts title, description, JSON-LD and heuristic **products/services**, organization data, social profile links, contact details, languages, logo/favicon/og:image, and `theme-color` into `ExtractedObservation` records.
- After the crawl, aggregates discovered products/services into scan-level `catalog.products` / `catalog.services` observations for profile draft and AI analysis.

### JavaScript rendering (optional)

By default the crawler parses the **initial HTML** only (`BRAND_SCANNER_JS_RENDER_MODE=off`).

When the worker has `playwright-core` and Chromium available, set:

| Variable                                 | Default | Purpose                                                                                                                                             |
| ---------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BRAND_SCANNER_JS_RENDER_MODE`           | `off`   | `off` \| `auto` \| `always` — `auto` re-fetches with headless Chromium when the page looks like an SPA shell or a catalog path returned no products |
| `BRAND_SCANNER_JS_RENDER_TIMEOUT_MS`     | `30000` | Per-page render timeout                                                                                                                             |
| `BRAND_SCANNER_JS_BLOCK_HEAVY_RESOURCES` | `true`  | Block images/fonts/media during render to save RAM                                                                                                  |

`auto` keeps static fetch first; Playwright runs only when heuristics say JS is likely required. In `always` mode, every HTML page is re-fetched with Chromium after the static response when rendering succeeds. Evidence from rendered pages is stored with `extractionMethod=RENDERED_JS`.

**Worker runtime (Render/Docker):** Chromium must exist **on the worker service only**. The API does not run Playwright.

1. Add to the **worker build** (once per deploy/image):

   ```bash
   pnpm --filter @oma/worker run setup:chromium
   ```

   Equivalent: `pnpm exec playwright install --with-deps chromium` from the repo root after `pnpm install`.

2. Or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to a system Chrome/Chromium binary path.

3. Set `BRAND_SCANNER_JS_RENDER_MODE=auto` or `always` on **worker env** only.

Without a binary, coverage reports `js_render_errors: ["PLAYWRIGHT_LAUNCH_FAILED"]`, `js_render_launch_detail` with the worker diagnostic, `pages_js_render_failed` ≈ `pages_js_render_attempted`, and `pages_js_rendered` stays **0** (static crawl may still complete as PARTIAL).

After installing Chromium, **start a new scan** — previous scan rows are immutable.

Scan coverage also reports `pages_js_render_attempted`, `pages_js_render_failed`, and up to five distinct `js_render_errors` codes for operations debugging.

## Environment variables

| Variable                            | Default                                   | Purpose                                                          |
| ----------------------------------- | ----------------------------------------- | ---------------------------------------------------------------- |
| `BRAND_WEBSITE_CONNECTOR`           | unset (`live`, unless fixture flag is on) | Adapter selection                                                |
| `BRAND_FIXTURE_CONNECTOR`           | unset                                     | `1` enables fixtures outside production                          |
| `BRAND_MAX_PAGES`                   | `50`                                      | Maximum HTML pages per scan                                      |
| `BRAND_MAX_DEPTH`                   | `3`                                       | Maximum link depth                                               |
| `BRAND_MAX_DURATION_SECONDS`        | `600`                                     | Scan wall-clock limit                                            |
| `BRAND_MAX_BYTES`                   | `1000000`                                 | Maximum response body size                                       |
| `BRAND_MAX_SITEMAP_DOCUMENTS`       | `5`                                       | Sitemap files (including indexes) to fetch                       |
| `BRAND_SCANNER_USER_AGENT`          | `OMA-BrandScanner/1.0 (+https://oma.ai)`  | Crawler identity                                                 |
| `BRAND_SCANNER_ACCEPT_LANGUAGE`     | `en,ar;q=0.9`                             | `Accept-Language` header                                         |
| `BRAND_SCANNER_IGNORE_ROBOTS_TXT`   | `true`                                    | When true, `Disallow` rules in robots.txt do not skip pages      |
| `BRAND_SCANNER_PATH_SEEDS`          | (built-in list)                           | Comma-separated extra paths, e.g. `/offers,/ar/services`         |
| `BRAND_SCANNER_TIMEOUT_MS`          | `15000`                                   | Total per-request timeout                                        |
| `BRAND_SCANNER_CONNECT_TIMEOUT_MS`  | `5000`                                    | TCP/TLS connect timeout                                          |
| `BRAND_SCANNER_MAX_REDIRECTS`       | `5`                                       | Redirect hop limit                                               |
| `BRAND_SCANNER_CONCURRENCY`         | `1`                                       | Max in-flight requests per host                                  |
| `BRAND_SCANNER_DELAY_MS`            | `500`                                     | Minimum delay between requests to a host                         |
| `BRAND_SCANNER_MAX_RETRIES`         | `2`                                       | Extra attempts after 429/503                                     |
| `BRAND_ALLOWED_PORTS`               | `80,443`                                  | Allowed destination ports                                        |
| `BRAND_SCANNER_ALLOW_PRIVATE_HOSTS` | off                                       | Test-only loopback override; rejected when `NODE_ENV=production` |

CI and local demo scripts still set `BRAND_FIXTURE_CONNECTOR=1` so existing fixture-based tests stay deterministic. Fixture crawls do not enqueue the extra marketing/sitemap path seeds (only link-following from fixture HTML); live crawls use the full seed set.
