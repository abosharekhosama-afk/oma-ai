# Billing, plans, and payments

OMA bills per workspace. List prices are **USD before VAT**. VAT lives in `BillingSettings` (id `platform`) so it can be changed without a code deploy. The default is **17% (1700 bps)** because Israeli VAT is currently 18% and should be edited in settings rather than hard-coded.

## Plans

Seeded into `Plan` / `PlanLimit` / `PlanFeature` (editable):

|                          | Starter |   Pro | Agency |
| ------------------------ | ------: | ----: | -----: |
| Monthly price (ex-VAT)   |     $39 |   $79 |   $249 |
| Brands                   |       3 |    10 |     25 |
| Social accounts          |       4 |    10 |     30 |
| Seats                    |       3 |    10 |     25 |
| Scheduled posts / period |      60 |   300 |  1,500 |
| AI credits / period      |     300 | 1,500 |  6,000 |
| Listening keywords       |       3 |    10 |     30 |
| Mentions / period        |   1,000 | 5,000 | 25,000 |

Yearly billing charges **10 months** (two months complimentary). New workspaces start on Starter in `trialing` when `trialDays` > 0 (default 14). Existing workspaces without a row are grandfathered to Pro so current work is not blocked.

**Paid X API access** is an add-on (`xApiAddon` on the subscription, price in `BillingSettings.xApiAddonMonthlyUsdCents`, default $29/mo before VAT). Connecting an X account requires the add-on.

Legacy catalog codes `free` / `basic` / `enterprise` map to `starter` / `starter` / `agency`.

## Deploy

1. Set billing environment variables on **API and worker** (see below). Never commit secrets.
2. Run Prisma migrations: `pnpm --filter @oma/db migrate:deploy` (or `prisma migrate deploy`).
3. Optionally run `pnpm --filter @oma/db seed` to sync system profiles (including `billing.manage` and the Billing role). The migration already grants `billing.manage` to company and platform owners and upserts the three plans.
4. In Stripe, create a webhook endpoint pointing at `https://<api-host>/api/webhooks/billing/stripe` for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
     Use the signing secret as `STRIPE_WEBHOOK_SECRET`. The handler verifies `Stripe-Signature` against the **raw** body.
5. In Lahza (Bank of Palestine gateway), set the webhook URL to `https://<api-host>/api/webhooks/billing/lahza`. Signatures use HMAC-SHA256 of the raw body in `x-lahza-signature` ([docs](https://docs.lahza.io/payments/webhooks)).
6. Open **Platform billing** (`/app/admin/billing`) as the platform owner to set VAT (use `18` for Israel) and bank-transfer instructions.
7. Confirm `WEB_BASE_URL` (or `WEB_ORIGIN`) so Checkout success/cancel URLs and the Stripe customer portal return to the app.

## Environment variables

| Variable                         | Required for              | Purpose                                                                                                                                  |
| -------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `STRIPE_SECRET_KEY`              | Stripe                    | Server-side Checkout, subscriptions, customer portal. Never expose to the browser.                                                       |
| `STRIPE_WEBHOOK_SECRET`          | Stripe                    | Verify `Stripe-Signature` on `/api/webhooks/billing/stripe`.                                                                             |
| `LAHZA_SECRET_KEY`               | Lahza / Bank of Palestine | Documented server calls: `POST /transaction/initialize`, `GET /transaction/verify/:reference`, `POST /transaction/charge_authorization`. |
| `LAHZA_PUBLIC_KEY`               | Lahza (optional UI)       | Public key from the Lahza dashboard (not used to charge).                                                                                |
| `LAHZA_WEBHOOK_SECRET`           | Lahza                     | If unset, the handler falls back to `LAHZA_SECRET_KEY` as their Node sample does.                                                        |
| `WEB_BASE_URL`                   | All hosted checkouts      | Success, cancel, and portal return URLs.                                                                                                 |
| `JAWWAL_PAY_ENABLED`             | Jawwal Pay UI             | `1` to show Jawwal Pay as a **manual** method.                                                                                           |
| `PALPAY_ENABLED`                 | PalPay UI                 | `1` to show PalPay as a **manual** method.                                                                                               |
| `REFLECT_ENABLED`                | Reflect UI                | `1` to show Reflect as a **manual** method.                                                                                              |
| `BILLING_BANK_TRANSFER_DISABLED` | Bank transfer             | `1` hides the generic bank-transfer method.                                                                                              |

No card data is stored. Stripe and Lahza keep cards on their side. The only provider secret we persist is Lahza’s `authorization_code` (for documented recurring charges), and it is never returned to clients.

## Provider onboarding

### Stripe — live

1. Create a Stripe account and product-capable secret key (`sk_test_…` then `sk_live_…`).
2. Enable Customer portal (invoices, payment methods, cancel).
3. Register the webhook URL above and copy the signing secret.
4. Checkout amounts are computed on the server (plan price + VAT + optional X add-on). The client cannot set a total.

### Manual activation — live

Platform owners (`platform.support.access`) use `/app/admin/billing` to **activate**, **extend**, or **cancel** a workspace plan with a reference/receipt note. Every action is written to the audit log (`billing.plan.activated`, `billing.manual.extend`, `billing.manual.cancel`, `billing.manual.proof_uploaded`, `billing.manual.reject`).

Workspace owners and the Billing role (`billing.manage`) can start checkout and submit proof. They cannot grant themselves a paid plan.

Upgrade or pay opens a **provider-selection card** listing only configured providers (Stripe, Lahza, Jawwal Pay, PalPay, Reflect, and bank transfer). Stripe and Lahza redirect to their hosted checkout. Manual providers mint an `OMA-…` reference, then collect transfer details (sender name, phone/account, amount, date, transaction reference) and a receipt image (JPEG/PNG/WebP/GIF, max 4 MB). Admin billing (`/app/admin/billing`) shows those details, a receipt preview, status filters, and approve/reject with a note.

The platform-owner account (`platform.support.access` on the current tenant) sees an admin-oriented billing page instead of tenant plan cards and plan-change controls. Changing `BillingSettings.vatRateBps` updates `listPlans()` / checkout quotes and the including-VAT totals on `/app/billing`.

### Lahza / Bank of Palestine — live when keys are set

Bank of Palestine’s public payment gateway is **Lahza** ([merchant page](https://web.bankofpalestine.com/business/electronic-services/digital-payments/payment-gateway), [developer docs](https://docs.lahza.io)):

- `POST https://api.lahza.io/transaction/initialize`
- `GET https://api.lahza.io/transaction/verify/:reference`
- `POST https://api.lahza.io/transaction/charge_authorization`
- Webhook event `charge.success` with `x-lahza-signature`

OMA does not invent other paths. Apply for a Lahza merchant account (ILS / JOD / USD), put the secret key in env, and use test keys until go-live. A successful first charge can store `authorization_code` for later documented recurring charges.

### Jawwal Pay — manual until they issue an API

[jawwalpay.ps](https://www.jawwalpay.ps/products/online-merchant-gateway.html) describes an online merchant gateway and older mobile SDKs exist, but there is **no public merchant REST API or sandbox documentation** to implement safely. Set `JAWWAL_PAY_ENABLED=1` to offer the manual flow (instructions + reference + proof + owner approval). Contact Jawwal Pay (1700-555-555 / info@JawwalPay.ps) for a merchant account. Do not invent endpoints.

### PalPay — manual until they issue an API

[palpay.ps/en/merchants](https://www.palpay.ps/en/merchants) lists POS, SoftPOS, and e-commerce products without a public checkout API. Set `PALPAY_ENABLED=1` for the manual flow. Merchant services: 0562900919.

### Reflect (Palestine) — manual

[pal.reflectapp.com](https://pal.reflectapp.com/) is a consumer neo-bank with QR “Scan & Pay”. It has **no public merchant API**. `docs.reflect.money` belongs to a different product (stablecoin kits) and must not be used here. Set `REFLECT_ENABLED=1` for the manual flow.

### Generic bank transfer — live

Always available unless `BILLING_BANK_TRANSFER_DISABLED=1`. The customer receives a unique `OMA-…` reference, pays the **server-computed** total (including VAT), and uploads a proof note. The platform owner approves it in admin.

## Upgrading without Stripe or Lahza

The billing page (`/app/billing`) opens a provider picker, then posts to `POST /api/v1/billing/checkouts`. If `STRIPE_SECRET_KEY` or `LAHZA_SECRET_KEY` is missing, those providers are hidden and the upgrade still succeeds as a **bank-transfer / manual** request: the API creates a pending `ManualPaymentOrder` with an `OMA-…` reference, the customer submits transfer details plus a receipt image to `POST /api/v1/billing/manual-orders/proof`, and the platform owner reviews it from `/app/admin/billing`.

Stripe appears only when `STRIPE_SECRET_KEY` is set (and webhooks need `STRIPE_WEBHOOK_SECRET`). Lahza / Bank of Palestine appears only when `LAHZA_SECRET_KEY` is set.

## Enforcement

Usage is checked on the server, never in the UI alone:

- Snapshot limits: brands, social accounts, seats, guests, storage, listening keywords.
- Period counters (`BillingUsageCounter`, unique per tenant + period start + key): scheduled posts, AI credits, mentions. Increments are atomic (`INSERT … ON CONFLICT … WHERE used + n <= limit`).
- Counters reset automatically when a new billing period starts (new `periodStart` row).
- `past_due` workspaces keep working until `gracePeriodEndsAt` (default 7 days), then writes are blocked (`PLAN_INACTIVE`) without deleting data.
- API and worker paths: brand create, social connect, seat/guest invite, content schedule, AI calls, listening keyword writes, mention ingestion.

Clients receive `PLAN_LIMIT_REACHED`, `PLAN_FEATURE_REQUIRED`, `PLAN_INACTIVE`, or `ADDON_REQUIRED` with an `upgrade_path` of `/app/billing`.

## Security

- Secrets only in env (documented here and in `.env.example`).
- Webhooks verify signatures on raw bodies and store `BillingWebhookEvent` (`provider` + `eventId`) for idempotency.
- CSRF + session auth on browser mutations; webhooks are unauthenticated but signed.
- Rate limits: 20 req/min per IP on `/api/v1/billing` writes, 30 on `/api/v1/admin/billing` writes (plus the global limiter).
- Amounts are computed server-side from the catalog and VAT settings.
- RBAC: `billing.manage` for workspace owner / Billing role; `platform.support.access` for manual activation.

## Product surfaces

- Public pricing: landing page `#pricing`
- Workspace billing: `/app/billing` (plans, meters via `/app/subscription`, invoices, upgrade/downgrade, proof upload, Stripe portal)
- Super-admin: `/app/admin/billing`
