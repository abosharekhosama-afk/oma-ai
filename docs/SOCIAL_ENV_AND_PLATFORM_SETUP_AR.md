# إعداد المنصات الاجتماعية: متغيرات البيئة، الويب هوك، وجلب الرسائل

تقرير تشغيلي لما يلزم ضبطه على **السيرفر (API)** و**الـ Worker** لربط فيسبوك، إنستغرام، واتساب، لينكدإن، تيك توك، وX؛ ثم استقبال الويب هوك وجلب الرسائل/التعليقات والنشر.

لا تضع أسرارًا حقيقية في Git. انسخ الأسماء من `.env.example` إلى لوحة Render (أو ما يعادلها) فقط.

المصدر التقني الإنجليزي المختصر: [`docs/social-setup.md`](./social-setup.md).

---

## 1) الخدمات الثلاثة

| خدمة | أين تعمل عادة | دورها الاجتماعي |
| --- | --- | --- |
| **Web** | Vercel (`https://oma-ai-ecru.vercel.app`) | واجهة الربط والإنبوكس. تمرّر `/api/*` إلى الـ API حتى يبقى كوكي الجلسة على نفس الأصل. |
| **API (السيرفر)** | Render (أو أي استضافة للـ Nest API) | بدء OAuth، استقبال الويب هوك، حفظ الأحداث، وضع المهام في Redis. |
| **Worker** | Render (خدمة منفصلة) | نشر المنشورات المستحقة، تجديد التوكن، سحب الإنبوكس، جلب التفاعل. |

بدون **نفس** `SOCIAL_TOKEN_ENCRYPTION_KEY` على API وWorker تُرفض كل الشبكات بـ «غير متاح بعد»، حتى لو وُضعت مفاتيح ميتا/تيك توك.

بدون **نفس** `REDIS_URL` لا تصل أحداث الويب هوك من الـ API إلى الـ Worker.

---

## 2) عناوين تعتمد عليها المنصات

استبدل `<API_PUBLIC_URL>` بالأصل العلني للـ API كما يظهر في Render (بدون `/` أخيرة)، مثل `https://oma-xxxxx.onrender.com`.

| الغرض | القيمة التي تسجّلها في لوحات المزودين |
| --- | --- |
| أصل الويب (OAuth + جلسة) | `https://oma-ai-ecru.vercel.app` |
| أصل الـ API (ويب هوك فقط) | قيمة `API_PUBLIC_URL` |

روابط **OAuth** (سجّلها كما هي، عبر أصل الويب):

| الشبكة | Redirect URI |
| --- | --- |
| Facebook | `https://oma-ai-ecru.vercel.app/api/v1/social/oauth/facebook/callback` |
| Instagram | `https://oma-ai-ecru.vercel.app/api/v1/social/oauth/instagram/callback` |
| WhatsApp | `https://oma-ai-ecru.vercel.app/api/v1/social/oauth/whatsapp/callback` |
| LinkedIn | `https://oma-ai-ecru.vercel.app/api/v1/social/oauth/linkedin/callback` |
| TikTok | `https://oma-ai-ecru.vercel.app/api/v1/social/oauth/tiktok/callback` |
| X | `https://oma-ai-ecru.vercel.app/api/v1/social/oauth/x/callback` |

روابط **الويب هوك** (سجّلها على أصل الـ API، بدون جلسة، مع توقيع):

| المزود | Callback URL | التحقق |
| --- | --- | --- |
| ميتا (فيسبوك + إنستغرام + واتساب) | `<API_PUBLIC_URL>/api/webhooks/meta` | GET `hub.challenge` + `META_WEBHOOK_VERIFY_TOKEN` |
| واتساب (نفس التطبيق، مسار بديل) | `<API_PUBLIC_URL>/api/webhooks/whatsapp` | نفس توكن ميتا أو `WHATSAPP_VERIFY_TOKEN` |
| تيك توك | `<API_PUBLIC_URL>/api/webhooks/tiktok` | HMAC عبر `TIKTOK_WEBHOOK_SECRET` |
| لينكدإن | `<API_PUBLIC_URL>/api/webhooks/linkedin` | HMAC عبر `LINKEDIN_WEBHOOK_SECRET` |
| X | `<API_PUBLIC_URL>/api/webhooks/x` | CRC GET + HMAC عبر `X_WEBHOOK_SECRET` |

لا تستخدم مسار علامة مثل `/api/v1/brands/<id>/social-pages`. المسار الوحيد للـ OAuth هو `/api/v1/social/oauth/<network>/callback`.

---

## 3) لصق سريع على السيرفر (API)

ضعها كلها على خدمة الـ **API**. القيم الفارغة تُبقي الشبكة «غير متاح بعد».

```bash
# مشترك — إلزامي لأي ربط
SOCIAL_TOKEN_ENCRYPTION_KEY=
SOCIAL_OAUTH_REDIRECT_BASE=https://oma-ai-ecru.vercel.app
WEB_BASE_URL=https://oma-ai-ecru.vercel.app
WEB_ORIGIN=https://oma-ai-ecru.vercel.app
API_PUBLIC_URL=https://REPLACE-WITH-RENDER-API-ORIGIN
REDIS_URL=

# ميتا (فيسبوك + إنستغرام + واتساب)
META_APP_ID=
META_APP_SECRET=
META_GRAPH_VERSION=v21.0
META_WEBHOOK_VERIFY_TOKEN=
META_FACEBOOK_REDIRECT_URI=https://oma-ai-ecru.vercel.app/api/v1/social/oauth/facebook/callback
META_INSTAGRAM_REDIRECT_URI=https://oma-ai-ecru.vercel.app/api/v1/social/oauth/instagram/callback
WHATSAPP_REDIRECT_URI=https://oma-ai-ecru.vercel.app/api/v1/social/oauth/whatsapp/callback
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_BUSINESS_ACCOUNT_ID=

# لينكدإن
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_API_VERSION=202410
LINKEDIN_ORGANIZATIONS=0
LINKEDIN_REDIRECT_URI=https://oma-ai-ecru.vercel.app/api/v1/social/oauth/linkedin/callback
LINKEDIN_WEBHOOK_SECRET=

# تيك توك
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TIKTOK_REDIRECT_URI=https://oma-ai-ecru.vercel.app/api/v1/social/oauth/tiktok/callback
TIKTOK_ENABLE_DIRECT_POST=0
TIKTOK_PRIVACY_LEVEL=SELF_ONLY
TIKTOK_WEBHOOK_SECRET=
MEDIA_PROXY_ORIGIN=https://oma-ai-ecru.vercel.app

# X
X_CLIENT_ID=
X_CLIENT_SECRET=
X_REDIRECT_URI=https://oma-ai-ecru.vercel.app/api/v1/social/oauth/x/callback
X_WEBHOOK_SECRET=
```

توليد المفاتيح (شغّلها محليًا والصق الناتج، لا تحفظ الأمر مع القيمة في Git):

```bash
openssl rand -base64 32    # SOCIAL_TOKEN_ENCRYPTION_KEY
openssl rand -hex 16       # META_WEBHOOK_VERIFY_TOKEN و LINKEDIN/TIKTOK/X_WEBHOOK_SECRET
```

`SOCIAL_TOKEN_ENCRYPTION_KEY` يجب أن يكون 32 بايت: Base64 بطول 44 أو Hex بطول 64.

---

## 4) لصق سريع على الـ Worker

ضعها على خدمة الـ **Worker**. مفاتيح التطبيقات **نفس قيم الـ API** (وإلا يفشل النشر/السحب رغم نجاح الربط).

```bash
# مشترك — إلزامي
SOCIAL_TOKEN_ENCRYPTION_KEY=   # نفس قيمة الـ API حرفياً
REDIS_URL=                     # نفس Redis الـ API
WEB_BASE_URL=https://oma-ai-ecru.vercel.app
WEB_ORIGIN=https://oma-ai-ecru.vercel.app
MEDIA_PROXY_ORIGIN=https://oma-ai-ecru.vercel.app

# مفاتيح النشر / السحب (نفس الـ API)
META_APP_ID=
META_APP_SECRET=
META_GRAPH_VERSION=v21.0
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_API_VERSION=202410
LINKEDIN_ORGANIZATIONS=0
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TIKTOK_ENABLE_DIRECT_POST=0
TIKTOK_PRIVACY_LEVEL=SELF_ONLY
X_CLIENT_ID=
X_CLIENT_SECRET=

# إيقاع العامل (اختياري — هذه القيم هي الافتراضي)
SOCIAL_PUBLISH_INTERVAL_MS=30000
SOCIAL_REFRESH_INTERVAL_MS=900000
SOCIAL_INSIGHTS_INTERVAL_MS=900000
INBOX_SYNC_DAYS=14
INBOX_CONCURRENCY=5
# INBOX_DEFAULT_TENANT_ID=     # فقط إذا وصل ويب هوك قبل تعيين الصفحة المربوطة
```

الـ Worker **لا** يحتاج متغيرات الويب هوك (`META_WEBHOOK_VERIFY_TOKEN` و`*_WEBHOOK_SECRET`) لأن الاستقبال يتم على الـ API. يحتاج مفاتيح التطبيقات لفك التوكن المشفّر واستدعاء Graph/LinkedIn/TikTok/X.

---

## 5) كل متغير: أين، هل إلزامي، وماذا يفعل

### 5.1 مشترك

| المتغير | API | Worker | إلزامي | ماذا يلزم |
| --- | --- | --- | --- | --- |
| `SOCIAL_TOKEN_ENCRYPTION_KEY` | نعم | نعم (نفس القيمة) | **نعم لأي شبكة** | يشفر توكنات الحسابات (AES-256-GCM). تدويره يقطع كل الحسابات ويجب إعادة الربط. |
| `REDIS_URL` | نعم | نعم (نفس القيمة) | **نعم** للويب هوك والنشر غير المتزامن | طابور BullMQ: `inbox.webhook` و`inbox.sync` و`social`. |
| `SOCIAL_OAUTH_REDIRECT_BASE` | نعم | لا | مُفضّل | أصل بناء رابط الـ callback. ضعه على أصل الويب. |
| `WEB_BASE_URL` / `WEB_ORIGIN` | نعم | نعم | نعم للإنتاج | أصل فيرسل. يُستخدم في إعادة التوجيه بعد OAuth وروابط الإشعارات وبروكسي تيك توك. |
| `API_PUBLIC_URL` | نعم | لا* | نعم للويب هوك | الأصل العلني للـ API. هذا ما تسجّله ميتا/تيك توك كـ Callback. |
| `MEDIA_PROXY_ORIGIN` | اختياري | نعم لتيك توك | لتيك توك | نطاق عام يتحقق منه تيك توك لـ `PULL_FROM_URL`. عادة أصل الويب. |
| `SOCIAL_PUBLISH_INTERVAL_MS` | لا | اختياري | لا | كم مرة يفحص المنشورات المستحقة. الافتراضي 30000. |
| `SOCIAL_REFRESH_INTERVAL_MS` | لا | اختياري | لا | فحص/تجديد التوكن. الافتراضي 900000 (15 دقيقة). |
| `SOCIAL_INSIGHTS_INTERVAL_MS` | لا | اختياري | لا | سحب تفاعل المنشورات المنشورة. الافتراضي 900000. |
| `INBOX_SYNC_DAYS` | لا | اختياري | لا | عمق السحب التاريخي لفيسبوك/إنستغرام/X. الافتراضي 14 يومًا. |
| `INBOX_CONCURRENCY` | لا | اختياري | لا | توازي مهام الإنبوكس. الافتراضي 5. |
| `INBOX_DEFAULT_TENANT_ID` | لا | اختياري | لا | مستأجر احتياطي إذا وصل ويب هوك بلا صفحة مربوطة. اتركه فارغًا في الإنتاج ما لم تعرف الـ id. |

\*الـ Worker لا يستقبل الويب هوك، لكنه يحتاج أن يستطيع النداء للواجهات العامة عبر التوكن المحفوظ.

### 5.2 ميتا / واتساب

| المتغير | API | Worker | إلزامي لـ | ماذا يلزم |
| --- | --- | --- | --- | --- |
| `META_APP_ID` | نعم | نعم | فيسبوك + إنستغرام + واتساب | App ID من developers.facebook.com → التطبيق → Settings → Basic. |
| `META_APP_SECRET` | نعم | نعم | نفس الشبكات + توقيع الويب هوك | App Secret من نفس الصفحة. يُستخدم HMAC لـ `X-Hub-Signature-256`. |
| `META_GRAPH_VERSION` | نعم | نعم | لا (افتراضي `v21.0`) | إصدار Graph. أبقِه `v21.0` ما لم تطلب ميتا ترقية. |
| `META_WEBHOOK_VERIFY_TOKEN` | نعم | لا | الويب هوك | سلسلة عشوائية **تكتبها أنت** في ميتا وفي هذا المتغير. ليست من لوحة ميتا جاهزة. |
| `WHATSAPP_VERIFY_TOKEN` | نعم | لا | بديل | إن فُرغ `META_WEBHOOK_VERIFY_TOKEN` يُستخدم هذا. يُفضّل قيمة واحدة في الاثنين. |
| `META_FACEBOOK_REDIRECT_URI` | نعم | لا | إذا لم يُستخدم الأساس | يجب أن يطابق حرفيًا الـ URI في ميتا. |
| `META_INSTAGRAM_REDIRECT_URI` | نعم | لا | نفس المنطق | مسار إنستغرام منفصل رغم أن التطبيق واحد. |
| `WHATSAPP_REDIRECT_URI` | نعم | لا | واتساب | أو `META_WHATSAPP_REDIRECT_URI` كاسم بديل. |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | اختياري | لا | توثيق/اشتراك يدوي | معرف WABA. الاشتراك يتم أيضًا تلقائيًا بعد الربط عبر التوكن. |

### 5.3 لينكدإن

| المتغير | API | Worker | إلزامي | ماذا يلزم |
| --- | --- | --- | --- | --- |
| `LINKEDIN_CLIENT_ID` | نعم | نعم | نعم للربط | من linkedin.com/developers → التطبيق → Auth. |
| `LINKEDIN_CLIENT_SECRET` | نعم | نعم | نعم | نفس الصفحة. |
| `LINKEDIN_API_VERSION` | نعم | نعم | لا | `YYYYMM`، الافتراضي `202410`. |
| `LINKEDIN_ORGANIZATIONS` | نعم | نعم | لا | ضع `1` فقط بعد تفعيل Community Management API لربط صفحات الشركة. |
| `LINKEDIN_REDIRECT_URI` | نعم | لا | مُفضّل | يطابق Auth → Authorized redirect URLs. |
| `LINKEDIN_WEBHOOK_SECRET` | نعم | لا | للويب هوك | سر HMAC. إذا ضُبط، تُرفض الحمولات بلا توقيع. |

### 5.4 تيك توك

| المتغير | API | Worker | إلزامي | ماذا يلزم |
| --- | --- | --- | --- | --- |
| `TIKTOK_CLIENT_KEY` | نعم | نعم | نعم للربط | من developers.tiktok.com → التطبيق. |
| `TIKTOK_CLIENT_SECRET` | نعم | نعم | نعم | نفس الصفحة. |
| `TIKTOK_REDIRECT_URI` | نعم | لا | مُفضّل | يطابق Login Kit Redirect URI حرفياً. |
| `TIKTOK_ENABLE_DIRECT_POST` | نعم | نعم | للنشر المباشر | اتركه `0` حتى توافق تيك توك على `video.publish` ثم `1` وأعد ربط الحساب. |
| `TIKTOK_PRIVACY_LEVEL` | نعم | نعم | لا | الافتراضي `SELF_ONLY`. بعد التدقيق يمكن `PUBLIC_TO_EVERYONE`. |
| `TIKTOK_WEBHOOK_SECRET` | نعم | لا | للويب هوك | سر HMAC من بوابة تيك توك. |
| `TIKTOK_BRAND_CONTENT_TOGGLE` | اختياري | اختياري | إفصاح إعلان | `1` إذا كان المنشور يروّج لمنتج طرف ثالث. |
| `TIKTOK_BRAND_ORGANIC_TOGGLE` | اختياري | اختياري | إفصاح عضوي | `1` عند الحاجة حسب قواعد تيك توك. |

### 5.5 X

| المتغير | API | Worker | إلزامي | ماذا يلزم |
| --- | --- | --- | --- | --- |
| `X_CLIENT_ID` | نعم | نعم | نعم للربط | OAuth 2.0 Client ID من developer.x.com. |
| `X_CLIENT_SECRET` | نعم | نعم | نعم | OAuth 2.0 Client Secret (تطبيق confidential). |
| `X_REDIRECT_URI` | نعم | لا | مُفضّل | يطابق Callback URI في بوابة X. |
| `X_WEBHOOK_SECRET` | نعم | لا | للويب هوك | سر CRC/التوقيع. إن فُرغ يُستخدم `X_CLIENT_SECRET`. |

---

## 6) كيف تُجلب الرسائل من كل منصة

بعد ضبط المفاتيح وربط الحساب من **العلامة → الإعدادات → الحسابات** ثم فتح **الإنبوكس**:

| المنصة | المصدر الحي (ويب هوك) | السحب الدوري (Worker كل ~10 دقائق + زر المزامنة) | الرد من الإنبوكس |
| --- | --- | --- | --- |
| **فيسبوك** | `messages` + تعليقات `feed`/`comments`/`mention` على `/api/webhooks/meta` | نعم: منشورات الصفحة + تعليقات + محادثات Messenger لآخر `INBOX_SYNC_DAYS` | نعم (رسائل خاصة + رد على تعليق) |
| **إنستغرام** | `messages` + `comments` + `mentions` | نعم: تعليقات الوسائط + DMs | نعم |
| **واتساب** | Cloud API `messages` على `/api/webhooks/meta` أو `/whatsapp` | **لا يوجد أرشيف تاريخي كامل** في Cloud API. الرسائل تصل من لحظة الاشتراك فما بعد | نعم عبر `POST /{phone-number-id}/messages` (نافذة خدمة العملاء 24 ساعة بعد رسالة العميل) |
| **X** | Account Activity على `/api/webhooks/x` (DM + منشن/رد) | نعم: `GET /2/dm_events` + منشنات المستخدم (يتطلب `dm.read`) | نعم لـ DM (`dm.write`) |
| **لينكدإن** | أحداث التعليقات على `/api/webhooks/linkedin` عند تفعيل الاشتراك | ويب هوك أساسًا (لا سحب تاريخ كامل) | يُحفظ محليًا حتى اعتماد منتج المراسلة |
| **تيك توك** | أحداث التعليقات على `/api/webhooks/tiktok` | ويب هوك أساسًا | يُحفظ محليًا حتى اعتماد منتج المراسلة |

بعد الربط يحاول OMA اشتراك صفحة فيسبوك في `subscribed_apps` واشتراك WABA واتساب تلقائيًا. يبقى التسجيل في لوحة ميتا إلزاميًا (URL + Verify Token + الحقول).

---

## 7) خطوات إعداد كل منصة

### 7.1 ميتا — فيسبوك + إنستغرام (تطبيق واحد)

1. ادخل [developers.facebook.com](https://developers.facebook.com) → أنشئ تطبيقًا من نوع **Business**.
2. أضف المنتج **Facebook Login for Business**.
3. Settings → Basic: انسخ **App ID** و**App Secret** إلى `META_APP_ID` / `META_APP_SECRET` على API وWorker.
4. Facebook Login → Settings → **Valid OAuth Redirect URIs** أضف:
   - `https://oma-ai-ecru.vercel.app/api/v1/social/oauth/facebook/callback`
   - `https://oma-ai-ecru.vercel.app/api/v1/social/oauth/instagram/callback`
   - `https://oma-ai-ecru.vercel.app/api/v1/social/oauth/whatsapp/callback`
5. أضف المنتجات/الصلاحيات. OMA يطلب:
   - فيسبوك: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `pages_messaging`, `pages_manage_metadata`
   - إنستغرام: `pages_show_list`, `pages_read_engagement`, `business_management`, `instagram_basic`, `instagram_content_publish`, `instagram_manage_comments`, `instagram_manage_messages`, `instagram_manage_insights`
6. خارج وضع التطوير تحتاج **App Review** لهذه الصلاحيات.
7. إنستغرام يجب أن يكون حسابًا **احترافيًا مربوطًا بصفحة فيسبوك**.
8. **Webhooks** → Page:
   - Callback URL: `<API_PUBLIC_URL>/api/webhooks/meta`
   - Verify token: نفس `META_WEBHOOK_VERIFY_TOKEN`
   - الحقول: `messages`, `messaging_postbacks`, `feed`, `comments`, `mention`
9. **Webhooks** → Instagram: نفس الـ URL والتوكن، الحقول `comments`, `mentions`, `messages`.
10. أعد تشغيل API وWorker بعد حفظ المتغيرات.
11. في OMA: العلامة → الإعدادات → الحسابات → ربط Facebook ثم Instagram.

النشر: منشورات الصفحة عبر Graph. إنستغرام يحتاج صورة عامة. التفاعل يُسحب بعد نجاح النشر (`pages_read_engagement` / `instagram_manage_insights`). الحسابات القديمة لإنستغرام تحتاج **إعادة ربط** بعد إضافة صلاحية الرؤى.

### 7.2 واتساب Cloud API (نفس تطبيق ميتا)

1. في نفس التطبيق أضف منتج **WhatsApp**.
2. اربط **WhatsApp Business Account** ورقم هاتف تجاري مُتحقق.
3. Webhooks (منتج واتساب):
   - Callback: `<API_PUBLIC_URL>/api/webhooks/meta` أو `<API_PUBLIC_URL>/api/webhooks/whatsapp`
   - Verify token: `META_WEBHOOK_VERIFY_TOKEN`
   - اشترك في حقل **`messages`**
4. الصلاحيات عند الربط من OMA: `business_management`, `whatsapp_business_management`, `whatsapp_business_messaging`.
5. في OMA اربط شبكة **WhatsApp**. تظهر أرقام الهاتف التابعة لـ WABA المملوكة.
6. الرسائل الواردة تصل بالويب هوك فقط. الرد من الإنبوكس.
7. واتساب **ليس** قناة تقويم/فيد. اختيار واتساب كهدف نشر يُرفض.

للإنتاج خارج أرقام الاختبار تحتاج Meta Business Verification وحدود المراسلة المناسبة.

### 7.3 لينكدإن

1. [linkedin.com/developers](https://www.linkedin.com/developers) → أنشئ تطبيقًا.
2. Auth: انسخ Client ID / Secret إلى `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET`.
3. Authorized redirect URLs:
   `https://oma-ai-ecru.vercel.app/api/v1/social/oauth/linkedin/callback`
4. فعّل المنتجات:
   - **Sign In with LinkedIn using OpenID Connect**
   - **Share on LinkedIn**
5. الصلاحيات الافتراضية: `openid profile w_member_social`.
6. لصفحات الشركة: فعّل Community Management API ثم ضع `LINKEDIN_ORGANIZATIONS=1` على API وWorker وأعد الربط. صلاحيات إضافية: `w_organization_social`, `r_organization_admin`.
7. الويب هوك (إن وُجد اشتراك أحداث في لوحة لينكدإن):
   - URL: `<API_PUBLIC_URL>/api/webhooks/linkedin`
   - ضع السر في `LINKEDIN_WEBHOOK_SECRET`
8. التوكن القياسي ~60 يومًا بلا refresh على كثير من التطبيقات → سيظهر «إعادة ربط».

النشر: منشورات العضو (والمنظمة إن فُعّلت). الردود الصادرة من الإنبوكس تُحفظ محليًا في هذه المرحلة. التفاعل عبر Social Actions بعد النشر إن سمح الـ API.

### 7.4 تيك توك

1. [developers.tiktok.com](https://developers.tiktok.com) → أنشئ تطبيقًا.
2. انسخ Client Key / Secret إلى `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET`.
3. Login Kit → Redirect URI:
   `https://oma-ai-ecru.vercel.app/api/v1/social/oauth/tiktok/callback`
4. أضف **Login Kit** (يكفي `user.info.basic` للربط).
5. للنشر المباشر أضف **Content Posting API** واطلب `video.publish`. بعد الموافقة:
   - `TIKTOK_ENABLE_DIRECT_POST=1` على API وWorker
   - أعد ربط الحساب في OMA
6. سجّل نطاق `MEDIA_PROXY_ORIGIN` (أصل الويب) في إعدادات تيك توك لـ PULL_FROM_URL.
7. التطبيقات غير المدققة تنشر `SELF_ONLY` فقط.
8. الويب هوك: URL `<API_PUBLIC_URL>/api/webhooks/tiktok` والسر في `TIKTOK_WEBHOOK_SECRET`.
9. الصور: JPEG/WebP فقط. الفيديو: MP4/WebM/MOV ضمن حدود تيك توك.

الردود الصادرة من الإنبوكس محلية حتى اعتماد منتج المراسلة. العامل يتابع حالة النشر ولا يعتبر `publish_id` نجاحًا نهائيًا.

### 7.5 X (تويتر)

1. [developer.x.com](https://developer.x.com) → تطبيق من نوع **Web App, confidential client**.
2. فعّل OAuth 2.0 مع صلاحيات قراءة وكتابة.
3. Callback URI:
   `https://oma-ai-ecru.vercel.app/api/v1/social/oauth/x/callback`
4. انسخ OAuth 2.0 Client ID / Secret إلى `X_CLIENT_ID` / `X_CLIENT_SECRET`.
5. الصلاحيات التي يطلبها OMA: `tweet.read tweet.write users.read offline.access dm.read dm.write`.
6. النشر `POST /2/tweets` يحتاج خطة API تسمح بالكتابة. النص فقط في هذا المسار.
7. الرسائل المباشرة تحتاج منتج DM على التطبيق. **أعد ربط** أي حساب X رُبط قبل إضافة `dm.read`/`dm.write`.
8. الويب هوك (Account Activity إن كانت خطتك تشمله):
   - URL: `<API_PUBLIC_URL>/api/webhooks/x`
   - ميتا CRC: OMA يرد على GET `crc_token`
   - ضع `X_WEBHOOK_SECRET` (أو يعتمد على `X_CLIENT_SECRET`)
9. حتى بدون ويب هوك، الـ Worker يسحب DMs والمنشنات بعد الربط إذا وُجدت صلاحيات DM.

---

## 8) خطوات داخل OMA بعد المتغيرات

1. أعد نشر/إعادة تشغيل **API** و**Worker** (المتغيرات لا تُقرأ إلا عند الإقلاع).
2. سجّل الدخول → اختر العلامة → **الإعدادات → الحسابات**.
3. كل شبكة تظهر زر **ربط** فقط إذا وُجدت مفاتيحها + `SOCIAL_TOKEN_ENCRYPTION_KEY` على الـ API.
4. أكمل موافقة المزود واختر الصفحات/الأرقام.
5. افتح **الإنبوكس** وفلتر حسب القناة.
6. من الإنبوكس يمكن تشغيل المزامنة (تسحب فيسبوك/إنستغرام/X؛ واتساب يعتمد على الرسائل الجديدة عبر الويب هوك).
7. للنشر: أنشئ منشورًا، اختر الحسابات المتصلة (ليس واتساب)، اجدول بعد اعتماد السياسة.

---

## 9) قائمة تحقق سريعة

- [ ] `SOCIAL_TOKEN_ENCRYPTION_KEY` متطابق على API وWorker
- [ ] `REDIS_URL` متطابق ويعمل
- [ ] `SOCIAL_OAUTH_REDIRECT_BASE` = أصل فيرسل
- [ ] `API_PUBLIC_URL` = أصل Render العلني (HTTPS)
- [ ] روابط OAuth الستة مسجّلة في لوحات المزودين **حرفياً**
- [ ] ويب هوك ميتا يمرّ GET verify (يرجع `hub.challenge`)
- [ ] حقول ميتا: رسائل وتعليقات صفحة + إنستغرام + `messages` لواتساب
- [ ] تيك توك: `TIKTOK_ENABLE_DIRECT_POST=0` حتى الموافقة ثم `1` + إعادة ربط
- [ ] X: إعادة ربط بعد صلاحيات DM
- [ ] إنستغرام: إعادة ربط بعد `instagram_manage_insights` لجلب التفاعل
- [ ] تجربة: ربط حساب تجريبي → رسالة واردة تظهر في الإنبوكس → رد يصل على المنصة (فيسبوك/إنستغرام/واتساب/X)

---

## 10) حدود صادقة (لا تُخفى)

| الموضوع | الواقع في الكود الحالي |
| --- | --- |
| شبكة بلا مفاتيح | «غير متاح بعد» — لا يوجد اتصال وهمي |
| واتساب | مراسلة فقط، ليس نشر فيد |
| تاريخ واتساب قبل الاشتراك | غير متاح من Cloud API |
| رد تيك توك/لينكدإن من الإنبوكس | يُحفظ في OMA ولا يُرسل للمنصة حتى اعتماد منتج المراسلة |
| App Review | خارج وضع التطوير ميتا/تيك توك/لينكدإن ترفض الصلاحيات المتقدمة |
| تدوير `SOCIAL_TOKEN_ENCRYPTION_KEY` | يقطع كل الحسابات |
| توقيع الويب هوك | إذا ضُبط السر تُرفض الحمولات بلا توقيع صحيح |

بعد ضبط المتغيرات على السيرفر والـ Worker وإكمال خطوات اللوحات أعلاه، تكون القنوات جاهزة للربط الفعلي، والنشر (ما عدا واتساب)، وجلب الرسائل/التعليقات حسب الجدول في القسم 6.
