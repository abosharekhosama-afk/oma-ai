# خطة تنفيذ نظام الخطط والتسعير والاشتراكات والحدود في OMA AI

> **الغرض من الوثيقة:** هذه الخطة جاهزة للإرسال إلى Agent لتنفيذ نظام Billing حقيقي مرتبط بمساحة العمل/المؤسسة، مع فتح وإغلاق الميزات حسب الخطة، وفرض حدود الاستخدام من الواجهة والـAPI والـWorker.
>
> **المستودع:** `abosharekhosama-afk/oma-ai`
>
> **الفرع المقترح للتنفيذ:** `feat/billing-entitlements-usage-limits`
>
> **قاعدة مهمة:** لا تعتبر صفحة الأسعار الحالية نظام فوترة. الصفحة الحالية تجريبية فقط، واختيار الخطة فيها لا يغيّر قاعدة البيانات ولا ينشئ اشتراكاً.

---

## 1. الهدف النهائي

تنفيذ نظام يجعل كل Workspace/Tenant مرتبطاً بخطة واشتراك وحالة دفع وحدود استخدام واضحة، بحيث:

1. يستطيع المستخدم رؤية الخطط والأسعار والمزايا.
2. يستطيع الاشتراك أو الترقية أو التخفيض أو الإلغاء عبر Stripe.
3. يتم تحديث حالة الاشتراك من Stripe Webhooks فقط، وليس من الواجهة.
4. يتم فتح أو إغلاق الميزات حسب خطة المؤسسة.
5. يتم فرض الحدود من الخادم وليس من الواجهة فقط.
6. يتم منع تجاوز الحدود في:
   - إنشاء العلامات/مساحات العمل.
   - دعوة الأعضاء.
   - إضافة حسابات التواصل.
   - رفع الوسائط.
   - إنشاء وجدولة ونشر المنشورات.
   - تشغيل الذكاء الاصطناعي.
   - فحص المواقع.
   - التحليلات المتقدمة.
7. يعيد النظام رسالة مفهومة عند رفض العملية مع الحد الحالي ووقت إعادة التعيين.
8. يعيد الـWorker فحص الخطة قبل تنفيذ أي منشور مجدول.
9. تبقى بيانات المستخدم محفوظة عند الإلغاء أو انتهاء الاشتراك، مع إيقاف الميزات المدفوعة فقط.

---

## 2. قواعد غير قابلة للتفاوض

### 2.1 مصدر الحقيقة

- حالة الاشتراك الحالية مصدرها قاعدة البيانات بعد التحقق من Stripe Webhook.
- لا يتم تفعيل خطة مدفوعة اعتماداً على `success_url`.
- لا يتم قبول `planId` القادم من المتصفح لتحديد صلاحيات المستخدم.
- لا يتم وضع الحدود في ملفات React فقط.
- لا يتم وضع أرقام الحدود داخل Controllers بشكل منفصل.
- كل الحدود والميزات تكون في Registry مركزي قابل للاختبار.

### 2.2 مستوى الاشتراك

الاشتراك يكون على مستوى `Tenant`، لأن المؤسسة/مساحة العمل هي التي تستهلك:

- العلامات.
- الأعضاء.
- المنشورات.
- حسابات التواصل.
- التخزين.
- عمليات AI.
- فحوص المواقع.

صلاحيات المستخدم الحالية (`Capabilities`) تبقى كما هي، ويضاف إليها تحقق الخطة:

```text
User capability AND Tenant entitlement AND Tenant usage limit
```

مثال: لكي ينشر المستخدم منشوراً يجب أن:

1. يملك المستخدم `content.schedule` أو `content.publish` حسب العملية.
2. تسمح خطة الـTenant بالنشر الاجتماعي.
3. لا يكون الحد الشهري للنشر قد انتهى.
4. يكون الحساب الاجتماعي متصلاً وصالحاً.

### 2.3 حالات الاشتراك

يجب اعتماد الحالات التالية:

```text
TRIALING
ACTIVE
PAST_DUE
CANCELED
EXPIRED
INCOMPLETE
PAUSED
```

السلوك المقترح:

| الحالة | القراءة | إنشاء بيانات مجانية | الميزات المدفوعة | النشر المجدول |
|---|---:|---:|---:|---:|
| `TRIALING` | نعم | حسب الخطة | نعم | نعم |
| `ACTIVE` | نعم | نعم | نعم | نعم |
| `PAST_DUE` | نعم | محدود/حسب grace period | لا للعمليات الجديدة | لا للمنشورات الجديدة |
| `CANCELED` قبل نهاية الفترة | نعم | نعم حتى `currentPeriodEnd` | نعم حتى نهاية الفترة | نعم حتى نهاية الفترة مع إعادة فحص |
| `EXPIRED` | نعم | حسب Free فقط | لا | لا |
| `INCOMPLETE` | نعم | Free فقط | لا | لا |
| `PAUSED` | نعم | Free فقط | لا | لا |

لا تحذف بيانات المؤسسة تلقائياً عند الإلغاء.

---

## 3. كتالوج الخطط الأولي

هذه القيم تكون في كود مركزي ويفضل مزامنتها مع Stripe عبر متغيرات البيئة أو Seed موثق. لا تُكتب مباشرة داخل صفحة الأسعار فقط.

### 3.1 الخطط

```text
FREE
PRO
BUSINESS
```

### 3.2 الأسعار المبدئية

```text
FREE:     0
PRO:      29 USD / month
BUSINESS: 79 USD / month
```

السعر السنوي المقترح خصم 20%:

```text
PRO:      278.40 USD / year
BUSINESS: 758.40 USD / year
```

إذا كانت Stripe لا تدعم كسور السنت في العملة المحددة، خزّن السعر بأصغر وحدة للعملة (`amount` بالسنت) واستخدم أرقاماً صحيحة.

### 3.3 حدود الخطط الأولية

اجعل جميع القيم قابلة للتغيير من Registry أو قاعدة البيانات، ولا تكررها في أكثر من مكان.

| Metric / Feature | Free | Pro | Business |
|---|---:|---:|---:|
| `brands.max` | 1 | 10 | -1 = unlimited |
| `members.max` | 3 | 15 | -1 |
| `social_accounts.max` | 2 | 10 | -1 |
| `posts.created.month` | 30 | 1,000 | 5,000 |
| `posts.scheduled.month` | 10 | 500 | 2,000 |
| `posts.published.month` | 10 | 500 | 2,000 |
| `storage.bytes` | 2 GB | 50 GB | 250 GB |
| `media.video_max_bytes` | 100 MB | 500 MB | 2 GB |
| `ai.actions.month` | 25 | 500 | 2,000 |
| `website_scans.month` | 1 | 10 | 50 |
| `website_scan.pages_per_run` | 25 | 250 | 1,000 |
| `social.publish` | false | true | true |
| `analytics.advanced` | false | true | true |
| `social.multi_account` | false | true | true |
| `approval.advanced` | false | true | true |
| `audit.retention_days` | 7 | 90 | -1 |
| `analytics.retention_days` | 30 | 365 | -1 |
| `support.priority` | false | true | true |
| `custom_integrations` | false | false | true |

### 3.4 قواعد مهمة للحدود

- `-1` يعني غير محدود، ولا يعني أن الاستعلام يمكن أن يجلب بيانات بلا سقف تقني.
- حتى الخطط غير المحدودة يجب أن تخضع لـpagination وrate limits وحماية الموارد.
- حدود `month` تعتمد على فترة الاشتراك الحالية أو الشهر التقويمي؛ اعتمد **الشهر التقويمي UTC** في النسخة الأولى ودوّنه بوضوح.
- لا تستخدم توقيت جهاز المستخدم لحساب إعادة التعيين.
- أعد `resetAt` من الخادم بصيغة ISO UTC.
- حد التخزين تراكمي، وليس عداداً شهرياً.
- حد الفيديو يفحص قبل رفع الملف أو قبل إنشاء رابط WorkDrive.
- يجب تحديد هل `posts.created` يحسب المسودة أم المنشور النهائي؛ التوصية: يحسب المنشور عند إنشائه، ولا يعاد احتسابه عند التعديل.

---

## 4. تعديلات قاعدة البيانات

أضف Migration Prisma جديدة، ولا تعدل Migration قديمة تم تطبيقها.

### 4.1 جدول `Plan`

الحقول المطلوبة:

```text
id                 String @id
code               String @unique       // FREE, PRO, BUSINESS
nameKey            String
active             Boolean @default(true)
monthlyAmount      Int
annualAmount       Int?
currency            String @default("usd")
stripeProductId    String?
stripeMonthlyPriceId String?
stripeAnnualPriceId  String?
createdAt          DateTime @default(now())
updatedAt          DateTime @updatedAt
```

### 4.2 جدول `PlanEntitlement`

```text
id           String @id
planId       String
code         String                 // social.publish أو posts.scheduled.month
kind         String                 // feature أو limit
value        Int?                   // null للميزات، -1 للـunlimited
period       String?                // month, day, total, none
metadataJson String?
createdAt    DateTime @default(now())
updatedAt    DateTime @updatedAt
```

قيد فريد:

```text
@@unique([planId, code])
```

### 4.3 جدول `TenantSubscription`

```text
id                    String @id
tenantId              String
planId                String
status                String
stripeCustomerId      String?
stripeSubscriptionId  String? @unique
stripePriceId         String?
currentPeriodStart    DateTime?
currentPeriodEnd      DateTime?
trialEnd              DateTime?
cancelAtPeriodEnd      Boolean @default(false)
endedAt               DateTime?
lastStripeEventId     String?
createdAt             DateTime @default(now())
updatedAt             DateTime @updatedAt
```

قواعد:

- يمكن وجود سجل تاريخي متعدد لكل Tenant.
- يجب وجود اشتراك حالي واحد فقط منطقياً لكل Tenant.
- استخدم transaction أو قيداً مناسباً لمنع وجود اشتراكين حاليين.

### 4.4 جدول `BillingCustomer`

```text
id               String @id
tenantId          String @unique
stripeCustomerId String @unique
billingEmail     String?
createdAt        DateTime @default(now())
updatedAt        DateTime @updatedAt
```

### 4.5 جدول `BillingEvent`

ضروري لمنع تكرار Webhook:

```text
id              String @id
stripeEventId   String @unique
eventType       String
payloadHash     String?
processedAt     DateTime?
failedAt        DateTime?
failureReason   String?
createdAt       DateTime @default(now())
```

### 4.6 جدول `UsageCounter`

```text
id          String @id
tenantId    String
metricCode  String
periodKey   String       // مثال: 2026-11 أو total
periodStart DateTime?
periodEnd   DateTime?
used        Int @default(0)
updatedAt   DateTime @updatedAt
```

قيد فريد:

```text
@@unique([tenantId, metricCode, periodKey])
```

### 4.7 سجل العمليات الحساسة

إن لم يكن موجوداً في جدول Audit الحالي، تأكد من تسجيل:

- الاشتراك.
- الترقية.
- التخفيض.
- الإلغاء.
- فشل الدفع.
- رفض العملية بسبب حد الخطة.
- تغيير الخطة من Webhook.

لا تسجل مفاتيح Stripe أو بيانات البطاقة أو payload كامل يحتوي معلومات حساسة.

---

## 5. Registry مركزي للخطط والميزات والحدود

أنشئ ملفاً مشتركاً مناسباً، مثلاً:

```text
packages/domain/src/billing/plan-catalog.ts
packages/domain/src/billing/entitlements.ts
```

يجب أن يحتوي على:

```ts
export const PLAN_CODES = ['FREE', 'PRO', 'BUSINESS'] as const;

export const METRICS = {
  MAX_BRANDS: 'brands.max',
  MAX_MEMBERS: 'members.max',
  MAX_SOCIAL_ACCOUNTS: 'social_accounts.max',
  POSTS_CREATED_MONTH: 'posts.created.month',
  POSTS_SCHEDULED_MONTH: 'posts.scheduled.month',
  POSTS_PUBLISHED_MONTH: 'posts.published.month',
  STORAGE_BYTES: 'storage.bytes',
  VIDEO_MAX_BYTES: 'media.video_max_bytes',
  AI_ACTIONS_MONTH: 'ai.actions.month',
  WEBSITE_SCANS_MONTH: 'website_scans.month',
} as const;

export const FEATURES = {
  SOCIAL_PUBLISH: 'social.publish',
  ADVANCED_ANALYTICS: 'analytics.advanced',
  MULTI_SOCIAL_ACCOUNT: 'social.multi_account',
  ADVANCED_APPROVAL: 'approval.advanced',
  CUSTOM_INTEGRATIONS: 'custom_integrations',
} as const;
```

أضف دوالاً نقية قابلة للاختبار:

```ts
getPlanDefinition(planCode)
getFeatureEntitlement(planCode, featureCode)
getLimitEntitlement(planCode, metricCode)
isFeatureEnabled(planCode, featureCode)
getLimit(planCode, metricCode)
```

لا تجعل هذه الدوال تعتمد على Request أو Prisma.

---

## 6. خدمة Entitlements في الـAPI

أنشئ Service مركزية، مثلاً:

```text
apps/api/src/billing/billing.service.ts
apps/api/src/billing/entitlements.service.ts
apps/api/src/billing/usage.service.ts
```

### 6.1 الدوال المطلوبة

```ts
getCurrentSubscription(tenantId)
getCurrentPlan(tenantId)
getEntitlements(tenantId)
assertFeature(tenantId, featureCode)
getLimit(tenantId, metricCode)
getUsage(tenantId, metricCode, period)
assertWithinLimit(tenantId, metricCode, increment = 1)
incrementUsage(tenantId, metricCode, increment = 1)
getBillingSummary(tenantId)
```

### 6.2 شرط فحص الخطة

`assertFeature` يجب أن يرمي DomainError واضحاً:

```json
{
  "code": "PLAN_FEATURE_NOT_AVAILABLE",
  "feature": "social.publish",
  "plan": "FREE",
  "upgradeRequired": true
}
```

`assertWithinLimit` يجب أن يرمي:

```json
{
  "code": "PLAN_LIMIT_REACHED",
  "metric": "posts.published.month",
  "used": 10,
  "limit": 10,
  "remaining": 0,
  "resetAt": "2026-12-01T00:00:00.000Z",
  "upgradeRequired": true
}
```

### 6.3 الذرية

لا تستخدم التسلسل التالي بشكل منفصل في عمليات متزامنة:

```text
SELECT usage
if usage < limit
INSERT/UPDATE usage
```

استخدم transaction أو update ذرياً حتى لا يتجاوز طلبان متزامنان الحد.

القاعدة الصحيحة:

```text
reserve usage atomically
perform operation
commit or compensate on failure
```

لعمليات النشر، الأفضل إنشاء سجل محاولة أو حجز usage قبل الإرسال، ثم تعويض الحجز عند فشل دائم قابل لإعادة الاستخدام حسب السياسة.

---

## 7. ربط الخطة بالصلاحيات الحالية

لا تحذف `CapabilitiesGuard` ولا تستبدله.

أضف Guard أو decorator مستقل، مثلاً:

```ts
@RequireFeature('social.publish')
@ConsumeLimit('posts.published.month')
```

لكن لا تعتمد على Decorator وحده في العمليات المعقدة؛ استخدم Service صريحة داخل الخدمات الأساسية.

### 7.1 التحقق المقترح حسب العملية

| العملية | Capability | Feature | Limit |
|---|---|---|---|
| إنشاء Brand | `brand.create` | - | `brands.max` |
| دعوة عضو | `membership.invite` | - | `members.max` |
| إضافة حساب اجتماعي | صلاحية إدارة الحساب | `social.multi_account` عند الحساب الثاني | `social_accounts.max` |
| إنشاء منشور | `content.create` | - | `posts.created.month` |
| جدولة منشور | `content.schedule` | - | `posts.scheduled.month` |
| نشر اجتماعي | صلاحية النشر | `social.publish` | `posts.published.month` |
| تشغيل AI | capability AI | حسب نوع AI | `ai.actions.month` |
| Website scan | `brand.scan.control` | - | `website_scans.month` |
| رفع فيديو | media capability | - | `media.video_max_bytes` + `storage.bytes` |
| تحليلات متقدمة | `analytics.read` | `analytics.advanced` | - |
| تكامل مخصص | صلاحية الإدارة | `custom_integrations` | - |

### 7.2 ترتيب الفحوص

1. Authenticated user.
2. Tenant context.
3. Capability user.
4. Subscription status.
5. Feature entitlement.
6. Usage limit.
7. Business validation.
8. تنفيذ العملية.
9. تسجيل usage/audit.

لا تعرض للمستخدم خطأ صلاحيات عام إذا كان السبب الحقيقي هو انتهاء الخطة؛ استخدم كوداً منفصلاً يمكن للواجهة تفسيره.

---

## 8. Stripe Integration

### 8.1 الملفات المقترحة

```text
apps/api/src/billing/stripe.client.ts
apps/api/src/billing/billing.controller.ts
apps/api/src/billing/billing.service.ts
apps/api/src/billing/stripe-webhook.controller.ts
apps/api/src/billing/dto/billing.dto.ts
```

### 8.2 Endpoints المطلوبة

```text
GET  /api/v1/billing/plans
GET  /api/v1/billing/current
GET  /api/v1/billing/usage
POST /api/v1/billing/checkout-session
POST /api/v1/billing/portal-session
POST /api/v1/billing/cancel
POST /api/v1/billing/resume
POST /api/v1/billing/webhook/stripe
```

قواعد الحماية:

- كل endpoints ما عدا webhook تحتاج Auth وTenant context.
- إنشاء Checkout يحتاج `tenant.manage` أو صلاحية Billing مستقلة.
- Webhook لا يعتمد على جلسة المستخدم.
- Webhook يتحقق من Stripe signature باستخدام Raw Request Body.
- لا تقبل Webhook JSON تم تحويله وإعادة بنائه قبل التحقق من التوقيع.

### 8.3 إنشاء Checkout

عند طلب Checkout:

1. اقرأ الخطة من Catalog/DB، وليس من السعر المرسل مباشرة.
2. تحقق أن الخطة نشطة.
3. أنشئ أو اجلب Stripe Customer للمؤسسة.
4. استخدم Price ID الموجود في إعدادات الخطة.
5. أرسل `tenantId` و`planCode` في metadata.
6. اجعل `success_url` و`cancel_url` من allowlist/Environment، ولا تقبل URL عشوائياً.
7. لا تفعل الخطة هنا؛ انتظر Webhook.

### 8.4 Webhooks

تعامل مع الأحداث بشكل idempotent:

1. تحقق من signature.
2. تحقق هل `stripeEventId` عولج سابقاً.
3. خزّن الحدث أو hash آمن.
4. حدّث الاشتراك في transaction.
5. حدّث الخطة الحالية.
6. سجّل Audit.
7. أعد HTTP 2xx بعد نجاح المعالجة.
8. إذا فشلت المعالجة، أعد non-2xx ليعيد Stripe المحاولة.

الأحداث الأساسية:

```text
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.paid
invoice.payment_failed
```

لا تعتمد فقط على `checkout.session.completed` لأن حالة الدفع قد تتغير لاحقاً.

---

## 9. تحديث صفحة الأسعار

عدّل:

```text
apps/web/src/app/(app)/app/billing/billing-client.tsx
```

لتصبح مرتبطة بالـAPI بدلاً من Array ثابتة فقط.

### يجب أن تعرض الصفحة

- الخطة الحالية.
- حالة الاشتراك.
- تاريخ نهاية الفترة الحالية.
- هل الإلغاء في نهاية الفترة مفعل.
- السعر الشهري والسنوي الحقيقي من API.
- المزايا المفتوحة والمقفلة.
- الاستخدام الحالي مقابل الحد.
- زر Upgrade أو Downgrade.
- زر إدارة الفوترة عبر Customer Portal.
- زر إلغاء/استئناف الاشتراك.
- رسالة واضحة في حالة `PAST_DUE` أو `EXPIRED`.

### بعد الضغط على اختيار الخطة

- لا تغيّر `selected` فقط.
- اطلب Checkout Session من API.
- استخدم `window.location.assign(session.url)` أو Stripe Checkout حسب تصميم المشروع.
- عند العودة، اعرض حالة انتظار وتحديثاً من API؛ لا تعتبر العودة نجاحاً قبل وصول Webhook.

### مكون قابل لإعادة الاستخدام

أنشئ مكونات مثل:

```text
PlanCard
UsageMeter
FeatureGate
UpgradePrompt
BillingStatusBanner
```

واستخدم `FeatureGate` داخل الصفحات التي تحتوي ميزات مدفوعة.

---

## 10. تجربة المستخدم عند قفل ميزة

عند عدم توفر الميزة:

- لا تخفِ الميزة بالكامل إذا كان ذلك سيجعل المنتج غير مفهوم.
- اعرضها disabled أو مع قفل واضح.
- وضّح اسم الخطة المطلوبة.
- اعرض زر Upgrade.
- لا تعرض سبباً تقنياً مثل `Missing capability` للمستخدم النهائي.

مثال رسالة عربية:

```text
النشر الاجتماعي غير متاح في الخطة المجانية.
قم بالترقية إلى Pro لتوصيل الحسابات ونشر المحتوى تلقائياً.
```

عند تجاوز حد:

```text
وصلت مساحة العمل إلى حد 10 منشورات منشورة هذا الشهر.
سيُعاد تعيين الحد في 1 ديسمبر 2026، أو يمكنك الترقية الآن.
```

### أخطاء API المقترحة

```text
PLAN_FEATURE_NOT_AVAILABLE      403 أو 402
PLAN_LIMIT_REACHED               429 أو 403 حسب سياسة المنتج
SUBSCRIPTION_PAST_DUE            402
SUBSCRIPTION_EXPIRED             402
BILLING_NOT_CONFIGURED           503 في بيئة الإنتاج فقط
```

اختر status codes ثابتة ووثقها في API.

---

## 11. Worker والنشر المجدول

يجب تعديل Worker، ولا يكفي تعديل API.

قبل تنفيذ منشور مجدول:

1. اجلب الاشتراك الحالي للـTenant.
2. تحقق من أن الحالة تسمح بالنشر.
3. تحقق من `social.publish`.
4. تحقق من حساب التواصل والـOAuth token.
5. تحقق من الحد أو reservation الخاص بالنشر.
6. نفذ النشر.
7. سجل النتيجة.
8. لا تعيد المحاولة إلى ما لا نهاية إذا كان سبب الفشل خطة منتهية.

أضف حالات خطأ واضحة للوظيفة:

```text
BLOCKED_PLAN_FEATURE
BLOCKED_PLAN_LIMIT
BLOCKED_SUBSCRIPTION_STATUS
SOCIAL_ACCOUNT_REAUTH_REQUIRED
SOCIAL_PROVIDER_ERROR
```

إذا كانت الخطة منتهية، يجب أن تظهر المنشورات المجدولة في الواجهة بحالة مفهومة مثل:

```text
Blocked by plan
```

ولا يتم اعتبارها فشلاً تقنياً مؤقتاً يؤدي إلى retries لا نهائية.

---

## 12. التخزين والوسائط

قبل قبول رفع ملف:

1. تحقق من MIME الحقيقي وليس الامتداد فقط.
2. تحقق من الحجم الأقصى للخطة.
3. احسب استخدام التخزين من الملفات READY فقط.
4. لا تسمح بتجاوز `storage.bytes` عبر upload متزامن.
5. عند حذف ملف، حرر الاستخدام بعد نجاح الحذف أو استخدم reconciliation job.
6. عند WorkDrive، سجل الحجم إن كان متاحاً، وإلا أضف Job لمزامنة الاستخدام.

لا تجعل WorkDrive limit يختلط مع Plan limit؛ هناك:

```text
WorkDrive technical max
Plan max file size
Plan total storage quota
```

والحد النهائي هو الأصغر بينها.

---

## 13. AI والـWebsite Scan

### AI

أنشئ metric موحداً:

```text
ai.actions.month
```

يزداد عند بدء عملية AI المقبولة، مع تحديد هل الفشل يستهلك الرصيد أم لا. التوصية:

- فشل validation: لا يستهلك.
- فشل provider بعد الإرسال: يستهلك، لأن التكلفة حدثت.
- timeout غير معروف: سجله كـpending ثم عالجه بالمصالحة.

### Website Scan

احسب:

```text
website_scans.month
```

ويجب أيضاً تمرير حد الصفحات لكل تشغيل:

```text
website_scan.pages_per_run
```

لا تعتمد على الحد الموجود في UI؛ خدمة scan نفسها يجب أن تقطع الزحف عند حد الخطة.

---

## 14. API لملخص الاستخدام

أضف استجابة موحدة مثل:

```json
{
  "plan": {
    "code": "PRO",
    "name": "Pro",
    "status": "active",
    "current_period_end": "2026-12-01T00:00:00.000Z"
  },
  "features": {
    "social.publish": true,
    "analytics.advanced": true
  },
  "usage": [
    {
      "metric": "posts.published.month",
      "used": 42,
      "limit": 500,
      "remaining": 458,
      "reset_at": "2026-12-01T00:00:00.000Z"
    }
  ]
}
```

لا ترسل Stripe secret أو بيانات الدفع الحساسة إلى الواجهة.

---

## 15. Seed وبيئة التطوير

أضف Seed ثابتاً للخطط والـEntitlements:

- Free.
- Pro.
- Business.

في بيئة التطوير:

- اجعل كل Tenant جديد يبدأ بـFree أو Trial واضح.
- أضف خياراً محلياً لتعيين خطة اختبار عبر Seed فقط.
- لا تستخدم Stripe الحقيقي في الاختبارات الوحدوية.
- استخدم Stripe Test Mode في اختبار التكامل.
- لا تضع مفاتيح حقيقية في Git أو `.env.example`.

متغيرات التطوير المطلوبة:

```env
BILLING_ENABLED=false
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_PRO_MONTHLY=
STRIPE_PRICE_PRO_YEARLY=
STRIPE_PRICE_BUSINESS_MONTHLY=
STRIPE_PRICE_BUSINESS_YEARLY=
BILLING_DEFAULT_PLAN=FREE
BILLING_TRIAL_DAYS=0
```

سلوك `BILLING_ENABLED=false`:

- لا يفتح ميزات مدفوعة تلقائياً في الإنتاج.
- يجب أن يكون السلوك صريحاً: إما Free enforcement أو Test bypass محصور في `NODE_ENV=test` فقط.
- ممنوع استخدام bypass عام يمكن تفعيله عن طريق متغير بيئة بالخطأ في الإنتاج.

---

## 16. الاختبارات المطلوبة

### 16.1 Unit tests

اكتب اختبارات لـ:

- كل خطة وكل Feature.
- كل حد رقمي.
- `-1` غير محدود.
- reset period UTC.
- حالة انتهاء الاشتراك.
- `PAST_DUE`.
- رسالة `PLAN_LIMIT_REACHED`.
- رسالة `PLAN_FEATURE_NOT_AVAILABLE`.
- الحساب المتزامن لطلبين عند آخر وحدة متاحة.
- تغيير الخطة من Free إلى Pro.
- الرجوع من Pro إلى Free.

### 16.2 API integration tests

اختبر:

1. مستخدم يملك capability لكن Tenant على Free: العملية المدفوعة مرفوضة.
2. مستخدم لا يملك capability لكن Tenant على Pro: العملية مرفوضة.
3. كلاهما موجود: العملية تنجح.
4. الحد وصل للصفر: العملية مرفوضة.
5. الحد غير محدود: العملية تنجح مع pagination/rate limit.
6. Webhook مكرر: لا يكرر الاشتراك أو usage.
7. Webhook بتوقيع خاطئ: يرفض.
8. `invoice.payment_failed`: ينتقل إلى `PAST_DUE`.
9. إلغاء في نهاية الفترة: يبقى فعالاً حتى `currentPeriodEnd`.
10. وصول `currentPeriodEnd`: يتحول إلى Free/Expired حسب السياسة.

### 16.3 Worker tests

اختبر:

- Worker يمنع النشر عند انتهاء الخطة.
- Worker يمنع النشر عند تجاوز الحد.
- Worker لا يعيد retry لخطأ خطة دائم.
- Worker يعيد retry لأخطاء provider المؤقتة.
- تجديد الاشتراك يعيد السماح بالنشر.
- عدم وجود OAuth token لا يسبب retry لا نهائياً.

### 16.4 E2E

سيناريو كامل:

1. تسجيل الدخول.
2. فتح صفحة الأسعار.
3. اختيار Pro في Stripe Test Mode.
4. استقبال Webhook.
5. ظهور Pro في صفحة Billing.
6. ظهور Usage meters.
7. فتح Social publishing.
8. إنشاء منشور وجدولته.
9. تشغيل Worker.
10. نشره بنجاح.
11. الوصول إلى الحد.
12. ظهور رسالة Upgrade.
13. إلغاء الاشتراك.
14. توقف النشر بعد نهاية الفترة.

---

## 17. حماية وأمن

- تحقق من Stripe webhook signature على Raw Body.
- لا تسجل الأسرار في logs.
- لا ترسل بيانات البطاقة إلى API OMA.
- لا تسمح للمستخدم بتغيير `tenantId` في body.
- استخرج Tenant من الجلسة والسياق فقط.
- تحقق أن الحساب يملك `tenant.manage` قبل فتح Billing Portal.
- اجعل Webhook idempotent.
- أضف correlation ID لكل عملية Billing.
- استخدم transaction عند تحديث subscription وusage.
- لا تستخدم `Number` غير آمن للمبالغ؛ خزّن integer minor units.
- لا تعتمد على `window.location` لتحديد صلاحيات العميل.

---

## 18. خطة الترحيل والإطلاق

### المرحلة A: Catalog بدون دفع

- إضافة الجداول وSeed.
- ربط كل Tenant جديد بخطة Free.
- إنشاء Entitlements service.
- إضافة endpoint current/usage.
- إضافة enforcement للحدود.
- عدم تفعيل Stripe بعد.

### المرحلة B: Enforcement داخلي

- تفعيل الحماية على API.
- تفعيل الحماية على Worker.
- إضافة Usage meters.
- اختبار Free بالكامل.
- تشغيل Pro وBusiness محلياً عبر Seed.

### المرحلة C: Stripe Test Mode

- إنشاء Products وPrices في Stripe Test Mode.
- إضافة Checkout وPortal.
- إضافة Webhooks.
- اختبار الترقية والإلغاء وفشل الدفع.

### المرحلة D: Production Billing

- إضافة Production secrets إلى Render/Vercel بالطريقة الآمنة.
- إنشاء Webhook Production endpoint.
- تفعيل `BILLING_ENABLED=true` بعد نجاح Smoke Tests.
- مراقبة BillingEvent failures.
- مراقبة منشورات Worker blocked by plan.
- تفعيل Rollback flag إذا ظهر خلل.

---

## 19. معايير القبول النهائية

لا تعتبر المهمة مكتملة إلا إذا تحققت كل النقاط التالية:

- [ ] توجد Migration ناجحة وقابلة للتطبيق على قاعدة نظيفة وقاعدة موجودة.
- [ ] كل Tenant له اشتراك/خطة افتراضية واضحة.
- [ ] توجد خطط Free/Pro/Business من مصدر مركزي.
- [ ] الأسعار لا تعتمد على Array ثابت داخل React فقط.
- [ ] صفحة Billing تعرض الخطة الحالية وحالة الاشتراك والاستخدام.
- [ ] Checkout يعمل في Stripe Test Mode.
- [ ] Webhook signature والتحقق من التكرار يعملان.
- [ ] حالة الاشتراك تتحدث من Webhook.
- [ ] Feature gating يعمل في API.
- [ ] Limit gating يعمل في API.
- [ ] Worker يفحص الخطة قبل النشر.
- [ ] لا يمكن تجاوز الحدود بطلبين متزامنين.
- [ ] الحسابات المدفوعة لا تُفتح بمجرد تغيير frontend state.
- [ ] Free لا يستطيع النشر الاجتماعي.
- [ ] Pro يستطيع النشر ضمن الحد.
- [ ] Business يستطيع الميزات المتقدمة ضمن الحد.
- [ ] خطأ الحد يعرض `used`, `limit`, `remaining`, `resetAt`.
- [ ] الإلغاء لا يحذف البيانات.
- [ ] فشل الدفع لا يترك الاشتراك فعالاً بلا مراجعة.
- [ ] مفاتيح Stripe غير موجودة في Git.
- [ ] Unit/API/Worker/E2E tests ناجحة.
- [ ] Build للـAPI والـWorker والويب ناجح.
- [ ] `git diff --check` ناجح.
- [ ] توثيق Render وVercel ومتغيرات البيئة محدث.

---

## 20. الملفات المتوقع إنشاؤها أو تعديلها

### قاعدة البيانات

```text
packages/db/prisma/schema.prisma
packages/db/prisma/migrations/<timestamp>_billing_plans_subscriptions_usage/migration.sql
packages/db/prisma/seed.ts أو ملف seed الموجود فعلياً
```

### Domain

```text
packages/domain/src/billing/plan-catalog.ts
packages/domain/src/billing/entitlements.ts
packages/domain/src/billing/billing-errors.ts
packages/domain/src/index.ts
```

### API

```text
apps/api/src/billing/billing.module.ts
apps/api/src/billing/billing.controller.ts
apps/api/src/billing/billing.service.ts
apps/api/src/billing/entitlements.service.ts
apps/api/src/billing/usage.service.ts
apps/api/src/billing/stripe.client.ts
apps/api/src/billing/stripe-webhook.controller.ts
apps/api/src/app.module.ts
apps/api/src/content/content.service.ts
apps/api/src/social/social.service.ts
apps/api/src/media/media.service.ts
apps/api/src/brand/scan.service.ts
```

### Worker

```text
apps/worker/src/social/social-jobs.ts
apps/worker/src/billing/worker-entitlements.ts أو خدمة مشتركة مناسبة
```

### Web

```text
apps/web/src/app/(app)/app/billing/billing-client.tsx
apps/web/src/lib/billing-api.ts
apps/web/src/components/billing/feature-gate.tsx
apps/web/src/components/billing/usage-meter.tsx
apps/web/src/components/billing/upgrade-prompt.tsx
```

### Tests وDocs

```text
tests/unit/billing-*.test.ts
tests/integration/billing-*.test.ts
tests/integration/worker-billing-*.test.ts
docs/billing-setup.md
docs/billing-operations.md
.env.example
render.yaml أو وثائق Render الموجودة فعلياً
```

> قبل إنشاء أي ملف، يجب على Agent فحص البنية الحالية للمشروع وإعادة استخدام أسماء الملفات والخدمات القائمة بدلاً من إنشاء نسخ مكررة.

---

## 21. Prompt جاهز لإرساله إلى Agent

انسخ النص التالي كما هو:

```text
نفّذ نظام الخطط والتسعير والاشتراكات والحدود في مستودع OMA AI من آخر فرع رئيسي، على فرع مستقل باسم feat/billing-entitlements-usage-limits.

اقرأ أولاً بنية المشروع الحالية وملفات قاعدة البيانات والصلاحيات وصفحة billing وWorker النشر. لا تبدأ بتعديل الكود قبل إعداد inventory للملفات والخدمات التي ستتأثر.

المطلوب تنفيذ نظام حقيقي وليس واجهة شكلية:

1. أضف Catalog مركزي للخطط FREE/PRO/BUSINESS والميزات والحدود. لا تكرر أرقام الحدود داخل React أو Controllers.
2. أضف جداول Plan وPlanEntitlement وTenantSubscription وBillingCustomer وBillingEvent وUsageCounter عبر Prisma migration جديدة.
3. اربط الاشتراك بمستوى Tenant، مع اشتراك Free افتراضي واضح لكل Tenant.
4. أضف EntitlementsService وUsageService مع تحقق ذري من الحدود، ودعم -1 كغير محدود، وفترات UTC، وresetAt.
5. أضف أخطاء API منظمة: PLAN_FEATURE_NOT_AVAILABLE وPLAN_LIMIT_REACHED وSUBSCRIPTION_PAST_DUE وSUBSCRIPTION_EXPIRED.
6. اربط الخطة مع Capabilities الحالية: يجب توفر User capability وTenant feature وUsage allowance معاً.
7. أضف Stripe Checkout وCustomer Portal وWebhooks موقعة ومحمية وIdempotent. لا تفعل الخطة من success_url؛ Webhook هو مصدر الحقيقة.
8. عدّل صفحة Billing لتقرأ من API وتعرض الخطة الحالية والحالة والاستخدام والأزرار الحقيقية، مع الحفاظ على تصميم OMA/Planable.
9. طبّق enforcement على إنشاء العلامات، دعوة الأعضاء، الحسابات الاجتماعية، المنشورات، الجدولة، النشر، AI، Website Scan، التخزين والوسائط والتحليلات.
10. عدّل Worker النشر ليعيد فحص الاشتراك والميزة والحد قبل تنفيذ المنشور المجدول، وأوقف retry الدائم لأخطاء الخطة.
11. أضف usage summary API وUsageMeter وFeatureGate وUpgradePrompt في الواجهة.
12. لا تسمح بتجاوز الحدود بالتوازي أو عبر استدعاء API مباشر.
13. لا تسجل أو ترفع أسرار Stripe. تحقق من signature باستخدام Raw Body.
14. استخدم الأسعار والحدود الأولية الموجودة في وثيقة docs/BILLING_PLANS_IMPLEMENTATION_PLAN_AR.md، واجعلها قابلة للتغيير مركزياً.
15. أضف Unit tests وAPI integration tests وWorker tests وStripe webhook idempotency tests وE2E smoke test.
16. حدّث .env.example وdocs/billing-setup.md ووثائق Render/Vercel.
17. شغّل Prisma generate، TypeScript checks، tests، builds، وgit diff --check.
18. لا تعمل merge إلى الفرع الرئيسي. ارفع الفرع مع commit واضح وقدّم ملخصاً يتضمن الملفات، migrations، المتغيرات المطلوبة، الاختبارات، وأي قرار يحتاج موافقة.

معايير المنع:
- لا تعتمد على frontend state لتفعيل الخطة.
- لا تضف bypass عاماً في الإنتاج.
- لا تحذف البيانات عند إلغاء الاشتراك.
- لا تستخدم Stripe live keys في الاختبارات.
- لا تعتبر unlimited سبباً لإزالة pagination أو rate limits.
- لا تخلط صلاحيات المستخدم Capabilities مع صلاحيات الخطة Entitlements.
```

---

## 22. قرارات يجب اعتمادها قبل الإنتاج

هذه القرارات يمكن تنفيذها بالقيم المقترحة، لكن يجب اعتمادها تجارياً قبل تشغيل الدفع الحقيقي:

1. هل الاشتراك لكل Tenant أم لكل Brand؟ التوصية: Tenant.
2. هل Free يسمح بالنشر الاجتماعي؟ التوصية: لا.
3. هل المنشور الفاشل بسبب مزود خارجي يستهلك الحد؟ التوصية: نعم إذا تم الإرسال فعلياً، ولا إذا فشل قبل الإرسال.
4. هل المسودات تدخل في `posts.created`؟ التوصية: نعم عند الإنشاء.
5. هل الفترة شهر تقويمي أم فترة اشتراك؟ التوصية: شهر تقويمي UTC في الإصدار الأول.
6. ما مدة Grace period بعد فشل الدفع؟ التوصية: 3 أيام للقراءة، مع إيقاف العمليات الجديدة.
7. هل يتم Downgrade تلقائياً إلى Free أم تصبح المؤسسة Read-only؟ يجب اعتماد القرار قبل Webhook الإنتاج.
8. هل هناك ضريبة أو VAT؟ يجب تحديد البلد، العملة، وStripe Tax قبل تشغيل الدفع.
9. هل Business بسعر ثابت أم Contact Sales؟ الصفحة الحالية تعرض سعراً، ويمكن إبقاؤه كبداية.
10. ما سياسة استرجاع الرصيد عند حذف منشور أو ملف؟ يجب توثيقها قبل اعتماد عدادات الإنتاج.

**النهاية:** بعد تنفيذ هذه الخطة يصبح نظام التسعير مرتبطاً فعلياً بالبيانات والدفع والصلاحيات والاستخدام والـWorker، بدلاً من كونه صفحة عرض فقط.
