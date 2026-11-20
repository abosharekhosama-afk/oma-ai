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
- Seeds additional URLs from sitemap indexes and common locations (`/sitemap.xml`, `/wp-sitemap.xml`, …). Generic marketing paths (`/products`, `/shop`, …) are probed **only when the sitemap yields fewer than `BRAND_SCANNER_MARKETING_SEEDS_MIN_SITEMAP_URLS` (default 12)**. Missing seeds (HTTP 404/410) are recorded as `SKIPPED_LIMIT` + `MARKETING_SEED_MISS` and do not inflate `pages_failed` (including percent-encoded Arabic seed paths). Disable entirely with `BRAND_SCANNER_MARKETING_SEEDS=off` or custom `BRAND_SCANNER_PATH_SEEDS`. Rate limits (`HTTP 429`) are retried with backoff; duplicate canonical pages are deduplicated (`/` vs `/en`).
- Prioritizes catalog-like paths in the crawl queue when link budget is tight.
- Canonicalizes URLs (fragments and tracking parameters such as `utm_*` are stripped) and respects `link rel=canonical` plus `meta robots` `nofollow` when discovering links.
- Extracts title, description, JSON-LD, **products/services** (see below), organization data, social profile links, contact details, languages, logo/favicon/og:image, and `theme-color` into `ExtractedObservation` records.
- After the crawl, aggregates discovered products/services into scan-level `catalog.products` / `catalog.services` observations for profile draft and AI analysis.

### JavaScript rendering (optional)

By default the crawler parses the initial HTML first and automatically renders SPA/catalog pages when
the static result is empty or missing product media (`BRAND_SCANNER_JS_RENDER_MODE=auto`).

When the worker has `playwright-core` and Chromium available, set:

| Variable                                 | Default | Purpose                                                                                                                               |
| ---------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `BRAND_SCANNER_JS_RENDER_MODE`           | `auto`  | `off` \| `auto` \| `always` — `auto` re-fetches with headless Chromium when the page looks like an SPA shell or has weak catalog data |
| `BRAND_SCANNER_JS_RENDER_TIMEOUT_MS`     | `30000` | Per-page render timeout                                                                                                               |
| `BRAND_SCANNER_JS_BLOCK_HEAVY_RESOURCES` | `true`  | Block fonts and non-image media during render to save RAM                                                                             |
| `BRAND_SCANNER_JS_BLOCK_IMAGES`          | `false` | Optional low-memory mode; blocks images too, but can prevent lazy-loaded product galleries from being discovered                      |
| `BRAND_SCANNER_JS_RENDER_MAX_PAGES`      | `20`    | In `auto`, max Playwright renders per scan (`unlimited` or `0` = no cap). Static crawl continues for all pages.                       |
| `BRAND_SCANNER_JS_NETWORK_IDLE_MS`       | `6000`  | Wait for `networkidle` (ms); set `0` to skip and rely on settle only (faster, thinner SPAs).                                          |
| `BRAND_SCANNER_JS_SETTLE_MS`             | `1500`  | Extra delay after load before snapshot HTML (set `0` to skip).                                                                        |
| `BRAND_SCANNER_JS_WAIT_SELECTOR`         | (none)  | Optional CSS selector to wait for (e.g. product grid) before capture.                                                                 |

`auto` keeps static fetch first; Playwright runs only when heuristics say JS is likely required. Images
remain enabled during rendered scans so lazy loaders can populate product galleries. In `always` mode,
every HTML page is re-fetched with Chromium after the static response when rendering succeeds. Evidence
from rendered pages is stored with `extractionMethod=RENDERED_JS`.

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

### Cancelling scans

UI cancel sets `ScanAttempt` + `JobRun` to `CANCELLED`, removes **queued** BullMQ ingestion/analysis jobs when `REDIS_URL` is available, and the worker **polls abort every ~400ms** during sitemap/crawl/JS render. Playwright is shut down after each ingestion job to reduce memory on small workers.

Scan coverage also reports `pages_js_render_attempted`, `pages_js_render_failed`, and up to five distinct `js_render_errors` codes for operations debugging.

## Product catalog extraction

Products are only created from **product detail pages** or a store's **public catalog API**.
Category, collection, and home sections are classified as `COLLECTION` / `OTHER` and never
become products. Badge labels (`مميز`, `New`, `Sale`, …) are never product names.

Sources, in order of trust (stored per product as `extractionSource` + `confidence`):

| Source         | Confidence | How                                                                                                                                                      |
| -------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PLATFORM_API` | 0.97       | Shopify `/products.json`, WooCommerce Store API `/wp-json/wc/store/v1/products`, iGroup storefront content API (config read from the first-party bundle) |
| `JSON_LD`      | 0.92       | `Product` / `ProductGroup` (also inside `@graph`), `Offer` / `AggregateOffer` arrays (lowest price), variants. Salla/Zid stores are covered here.        |
| `MICRODATA`    | 0.85       | `itemscope` Product, scoped to its own item (nested related products ignored)                                                                            |
| `OPEN_GRAPH`   | 0.75       | `og:type=product` pages: multiple `og:image`, `product:price:*`                                                                                          |
| `DOM_DETAIL`   | 0.70       | Rendered product page: title, price / compare-at, availability, spec lists (SKU, brand, category › subcategory, attributes), description, own gallery    |

Platform APIs are only called for detected storefronts, always respect `robots.txt`, send no
credentials (only whitelisted `x-*` tenant headers), and are size/page bounded. When a
platform catalog is found, page crawling still runs (for brand data) but products come from
the catalog first and are merged with page data by identity.

**Identity / dedupe:** platform id → canonical product URL (locale prefix, query, and
`/collections/x/products/y` nesting removed) → SKU → name. Records with different URLs or
platform ids are never merged, so media can't be pooled onto one item.

**Media attribution:** only the product's own gallery (focal image, thumbnails, `og:image`,
API images in their sort order). Header/footer/nav, hero/category banners, logos, payment
badges, related / "you may also like" grids, other product cards, SVG/ICO, and images declared
smaller than 80px are excluded. URLs are normalized to CDN originals (`_200x`, `-300x300`)
and de-duplicated ignoring resize parameters; at most `BRAND_MAX_PRODUCT_MEDIA` per product.

**Coverage:** scan coverage reports `catalog_platform`, `catalog_platform_products`,
`catalog_platform_error`, `products_with_media`, and `product_media_imported`. The products
API returns a `summary` (with media / description / price / category / availability counts)
shown above the product grid.

### Re-importing media for an existing scan (reconciliation)

`POST /api/v1/brands/:brandId/scans/:scanId/catalog/reimport-media` (the "re-import media" button) re-reads
the catalog and reconciles the scan **in place**, idempotently:

1. Loads the platform catalog when available, then re-extracts each row's own page (JS render
   honors `BRAND_SCANNER_JS_RENDER_MODE`).
2. Rows that match a real product get fresh fields (price, compare-at, description, category,
   availability, attributes, source) and exactly that product's media: wrongly attributed
   `SCAN_*` links are unlinked, missing ones imported, order and thumbnail rewritten.
3. Rows that are positively **not** products (the page was re-read, or the platform catalog is
   complete, and the row is not there) and duplicate rows are deleted — **unless** they carry
   generated / human-reviewed media (`GENERATED_*`), in which case only their `SCAN_*` media is
   removed and the row is kept (`retained`).
4. Products the catalog lists that the scan missed are added.

Network failures never delete anything (`skipped`). `GENERATED_*` media is never touched.
Running it twice yields the same rows and links. Media import needs a connected WorkDrive.

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
| `BRAND_MAX_PRODUCTS`                | `1000`                                    | Maximum products/services stored per scan                        |
| `BRAND_MAX_PRODUCT_MEDIA`           | `20`                                      | Images/videos kept per product (max 50)                          |
| `BRAND_PLATFORM_ADAPTERS`           | on                                        | `0` disables platform catalog APIs (pages only)                  |
| `BRAND_PLATFORM_API_MAX_BYTES`      | `16000000`                                | Max body of one catalog API response                             |
| `BRAND_PLATFORM_API_MAX_PAGES`      | `8`                                       | Max paginated catalog API requests (Shopify/WooCommerce)         |
| `BRAND_PLATFORM_SCRIPT_MAX_BYTES`   | `6000000`                                 | Max first-party bundle read to detect storefront config          |
| `BRAND_REIMPORT_MAX_SECONDS`        | `900`                                     | Time budget of one media re-import / reconciliation              |
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
