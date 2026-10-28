# Email setup (Resend / Brevo) · إعداد البريد الإلكتروني (Resend / Brevo)

OMA sends invitation and password-reset emails through a transactional provider.
Supported providers: **[Resend](https://resend.com)** and **[Brevo](https://www.brevo.com)** (formerly Sendinblue).
Emails are sent by the **worker** (outbox → BullMQ `mail` queue). The **API** reads the same
settings to tell the UI whether email delivery is configured.

يرسل OMA رسائل الدعوة وإعادة تعيين كلمة المرور عبر مزوّد بريد معاملات.
المزوّدان المدعومان: **[Resend](https://resend.com)** و **[Brevo](https://www.brevo.com)**.
يتولى **الـ worker** الإرسال الفعلي، بينما تقرأ **الـ API** الإعدادات نفسها لتُظهر في الواجهة ما إذا كان البريد مُعدًّا.

---

## English

### Choose a provider

Set the provider key and `MAIL_FROM` on **both** the API and the worker Render services.
`MAIL_PROVIDER=resend` or `MAIL_PROVIDER=brevo` is recommended, but OMA also detects the
provider automatically when it is omitted. You only need one provider; leave the other key unset.

### A. Resend

#### 1. Create a Resend account
Sign up at <https://resend.com>.

#### 2. Add and verify your domain
1. In Resend → **Domains** → **Add Domain**, enter the domain you send from (a subdomain such as `mail.yourdomain.com` is recommended).
2. Resend shows DNS records. Add them at your DNS provider:
   - **SPF** — a `TXT` record (and an `MX` record on the `send` subdomain) authorising Resend to send for you.
   - **DKIM** — a `TXT` record (`resend._domainkey`) with Resend's public key.
   - **DMARC** (optional, recommended) — a `TXT` record on `_dmarc`, e.g. `v=DMARC1; p=none; rua=mailto:you@yourdomain.com`.
3. Click **Verify**. DNS changes can take from a few minutes up to 48 hours.

#### 3. Create an API key
Resend → **API Keys** → **Create API Key**, permission **Sending access** (optionally restricted to your domain). Copy it once; it is shown only once. Never commit it.

#### 4. Configure Render (Resend)
| Variable | Example | Required |
|---|---|---|
| `MAIL_PROVIDER` | `resend` | recommended |
| `RESEND_API_KEY` | `re_…` (secret) | yes |
| `MAIL_FROM` | `OMA <no-reply@mail.yourdomain.com>` | yes |
| `MAIL_REPLY_TO` | `support@yourdomain.com` | no |
| `WEB_ORIGIN` | `https://app.yourdomain.com` | yes on the worker (links in emails) |

#### 5. Testing without a domain
Until your domain is verified you can use `MAIL_FROM=OMA <onboarding@resend.dev>`. Resend's sandbox sender **only delivers to the email address that owns the Resend account**.

### B. Brevo

#### 1. Create a Brevo account
Sign up at <https://www.brevo.com> (free plan includes **300 emails/day**).

#### 2. Verify a sender email or domain
1. Brevo → **Senders, Domains & Dedicated IPs** → **Senders** → add the address you will send from, then confirm the verification email.
2. Or verify a whole domain (recommended for production) and add the SPF / DKIM / DMARC records Brevo shows.
3. **Gmail / free-mailbox senders:** using a `@gmail.com` (or similar consumer) address as `MAIL_FROM` often fails DMARC alignment and hurts deliverability. Prefer a domain you control.

#### 3. Create an API key
Brevo → **SMTP & API** → **API Keys** → **Generate a new API key**. Copy it once; never commit it.

#### 4. Configure Render (Brevo)
Set these on **both** the API web service and the worker background service:

| Variable | Example | Required |
|---|---|---|
| `MAIL_PROVIDER` | `brevo` | yes |
| `BREVO_API_KEY` | `xkeysib-…` (secret) | yes |
| `MAIL_FROM` | `OMA <no-reply@mail.yourdomain.com>` | yes (`Name <email>` is parsed into Brevo's sender object) |
| `MAIL_REPLY_TO` | `support@yourdomain.com` | no |
| `WEB_ORIGIN` | `https://app.yourdomain.com` | yes on the worker (links in emails) |

Redeploy both services after saving.

### Troubleshooting
- Worker logs `resend rejected the email` / `brevo rejected the email` with a status and hint: 401/403 → wrong key or unverified sender/domain; 400/422 → invalid `MAIL_FROM` or recipient.
- If a provider is selected but the key or sender is missing, the worker logs a configuration error; in production the job remains failed/retriable instead of being falsely marked as sent.
- Failed sends are retried by the queue (5 attempts) and recorded on the job as `MAIL_SEND_FAILED`. The API request that created the invite never fails because of email.
- When email is not configured, the invite dialog says so and shows a secure link to share manually.

---

## العربية

### اختيار المزوّد

أضف مفتاح المزوّد و`MAIL_FROM` إلى خدمتي **الـ API** و**الـ worker** في Render معًا.
يُفضّل ضبط `MAIL_PROVIDER` على `resend` أو `brevo`، لكن OMA يكتشف المزوّد تلقائيًا عند تركه فارغًا.
يكفي مزوّد واحد؛ اترك مفتاح المزوّد الآخر فارغًا.

### أ. Resend

#### ١. إنشاء حساب في Resend
سجّل في <https://resend.com>.

#### ٢. إضافة النطاق والتحقق منه
1. من **Domains** ← **Add Domain** أدخل النطاق الذي سترسل منه (يُفضّل نطاق فرعي مثل `mail.yourdomain.com`).
2. سيعرض Resend سجلات DNS، أضفها لدى مزوّد DNS (SPF و DKIM ويفضّل DMARC).
3. اضغط **Verify**. قد يستغرق انتشار DNS من دقائق حتى 48 ساعة.

#### ٣. إنشاء مفتاح API
من **API Keys** ← **Create API Key** بصلاحية **Sending access**. انسخ المفتاح فورًا ولا تضعه في الكود.

#### ٤. الإعداد على Render (Resend)
| المتغير | مثال | إلزامي |
|---|---|---|
| `MAIL_PROVIDER` | `resend` | مستحسن |
| `RESEND_API_KEY` | `re_…` (سري) | نعم |
| `MAIL_FROM` | `OMA <no-reply@mail.yourdomain.com>` | نعم |
| `MAIL_REPLY_TO` | `support@yourdomain.com` | لا |
| `WEB_ORIGIN` | `https://app.yourdomain.com` | نعم على الـ worker |

### ب. Brevo

#### ١. إنشاء حساب في Brevo
سجّل في <https://www.brevo.com> (الخطة المجانية: **300 رسالة يوميًا**).

#### ٢. التحقق من بريد المُرسِل أو النطاق
1. من **Senders, Domains & Dedicated IPs** ← **Senders** أضف العنوان الذي سترسل منه ثم أكّد رسالة التحقق.
2. أو تحقق من نطاق كامل (مُستحسن للإنتاج) وأضف سجلات SPF / DKIM / DMARC.
3. **تحذير مهم:** استخدام `@gmail.com` (أو بريد مجاني مشابه) كـ `MAIL_FROM` غالبًا يخالف محاذاة DMARC ويضعف وصول الرسائل. فضّل نطاقًا تملكه.

#### ٣. إنشاء مفتاح API
من **SMTP & API** ← **API Keys** ← **Generate a new API key**. انسخه مرة واحدة ولا تضعه في الكود.

#### ٤. الإعداد على Render (Brevo)
أضف المتغيرات التالية على خدمة **الـ API** وخدمة **الـ worker** كلتيهما:

| المتغير | مثال | إلزامي |
|---|---|---|
| `MAIL_PROVIDER` | `brevo` | نعم |
| `BREVO_API_KEY` | `xkeysib-…` (سري) | نعم |
| `MAIL_FROM` | `OMA <no-reply@mail.yourdomain.com>` | نعم (يُفكّك الاسم والبريد لصيغة Brevo) |
| `MAIL_REPLY_TO` | `support@yourdomain.com` | لا |
| `WEB_ORIGIN` | `https://app.yourdomain.com` | نعم على الـ worker |

ثم أعد نشر الخدمتين.

### حل المشكلات
- يسجّل الـ worker رسالة رفض مع رمز الحالة: 401/403 مفتاح خاطئ أو مُرسِل/نطاق غير مُتحقق منه؛ 400/422 عنوان مُرسِل أو مستلم غير صالح.
- إن كان المزوّد مضبوطًا دون مفتاح أو مُرسِل، يسجّل الـ worker خطأ الإعداد وتبقى المهمة قابلة لإعادة المحاولة بدل اعتبارها مرسلة.
- تُعاد محاولة الإرسال الفاشل تلقائيًا (5 محاولات)، ولا يفشل طلب إنشاء الدعوة بسبب البريد.
- عند عدم إعداد البريد، تُظهر نافذة الدعوة ذلك بوضوح مع رابط دعوة آمن للمشاركة يدويًا.

---

## Previews · معاينات

| English | العربية |
|---|---|
| ![Invite EN](screenshots/email/invite-en.png) | ![Invite AR](screenshots/email/invite-ar.png) |
| ![Reset EN](screenshots/email/reset-en.png) | ![Reset AR](screenshots/email/reset-ar.png) |
