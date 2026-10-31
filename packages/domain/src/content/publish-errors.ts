/**
 * Map raw adapter / worker publish errors into calm bilingual copy for the UI.
 * Never invent a success; unknown strings fall back to a generic failure message.
 */

export type PublishErrorCode =
  | 'SCOPE_MISSING'
  | 'TOKEN_EXPIRED'
  | 'NO_MEDIA'
  | 'NETWORK_NOT_CONFIGURED'
  | 'ACCOUNT_REMOVED'
  | 'ACCOUNT_REAUTH'
  | 'BRAND_ARCHIVED'
  | 'NOT_APPROVED'
  | 'WORKDRIVE'
  | 'PROVIDER_REJECTED'
  | 'UNKNOWN';

const RULES: Array<{ code: PublishErrorCode; test: (s: string) => boolean }> = [
  {
    code: 'SCOPE_MISSING',
    test: (s) =>
      /scope_missing|scope_not_authorized|video\.publish|not authorized for this app|Enable Direct Post/i.test(
        s,
      ),
  },
  {
    code: 'TOKEN_EXPIRED',
    test: (s) => /expired|needs to be reconnected|NEEDS_REAUTH|Access expired|reauth/i.test(s),
  },
  {
    code: 'NO_MEDIA',
    test: (s) => /image is required|media was removed|an image is required|no media/i.test(s),
  },
  {
    code: 'NETWORK_NOT_CONFIGURED',
    test: (s) => /Network is not configured|not configured/i.test(s),
  },
  {
    code: 'ACCOUNT_REMOVED',
    test: (s) => /account was removed|DISCONNECTED/i.test(s),
  },
  {
    code: 'ACCOUNT_REAUTH',
    test: (s) => /reconnect/i.test(s),
  },
  {
    code: 'BRAND_ARCHIVED',
    test: (s) => /Brand is archived/i.test(s),
  },
  {
    code: 'NOT_APPROVED',
    test: (s) =>
      /not (fully )?approved|approval required|APPROVAL_REQUIRED|Skipped:.*approv/i.test(s),
  },
  {
    code: 'WORKDRIVE',
    test: (s) => /WorkDrive/i.test(s),
  },
  {
    code: 'PROVIDER_REJECTED',
    test: (s) =>
      /tiktok\s*(?::|\[)|facebook\s*(?::|\[)|instagram\s*(?::|\[)|linkedin\s*(?::|\[)|x\s*(?::|\[)|provider|rejected|http_status=\d{3}/i.test(
        s,
      ),
  },
];

function providerDetail(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim();
  if (!value) return null;
  // Provider responses are already redacted by the adapters; expose their code, message,
  // log id and HTTP status, but never expose request headers or access tokens.
  return value.slice(0, 700);
}

export function classifyPublishError(raw: string | null | undefined): PublishErrorCode {
  const s = (raw ?? '').trim();
  if (!s) return 'UNKNOWN';
  for (const r of RULES) {
    if (r.test(s)) return r.code;
  }
  return 'UNKNOWN';
}

const EN: Record<PublishErrorCode, string> = {
  SCOPE_MISSING:
    'Publishing permission is missing. Enable Direct Post for this network, then reconnect the account.',
  TOKEN_EXPIRED: 'The connected account expired. Reconnect it in Brand → Settings → Accounts.',
  NO_MEDIA: 'This post needs a public image before it can be published.',
  NETWORK_NOT_CONFIGURED: 'This network is not configured on the server yet.',
  ACCOUNT_REMOVED: 'The connected publishing account was removed.',
  ACCOUNT_REAUTH: 'The connected account needs to be reconnected.',
  BRAND_ARCHIVED: 'This brand is archived, so publishing was stopped.',
  NOT_APPROVED: 'Publishing waits until the post is fully approved.',
  WORKDRIVE: 'Media storage is unavailable. Check WorkDrive and try again.',
  PROVIDER_REJECTED: 'The network rejected this post. Check the account permissions and try again.',
  UNKNOWN: 'Publishing failed. Check the connected account and try again.',
};

const AR: Record<PublishErrorCode, string> = {
  SCOPE_MISSING: 'صلاحية النشر غير متوفرة. فعّل Direct Post لهذه الشبكة ثم أعد ربط الحساب.',
  TOKEN_EXPIRED: 'انتهت صلاحية الحساب المتصل. أعد ربطه من العلامة → الإعدادات → الحسابات.',
  NO_MEDIA: 'يحتاج هذا المنشور إلى صورة عامة قبل النشر.',
  NETWORK_NOT_CONFIGURED: 'هذه الشبكة غير مُعدّة على الخادم بعد.',
  ACCOUNT_REMOVED: 'تمت إزالة حساب النشر المتصل.',
  ACCOUNT_REAUTH: 'يحتاج الحساب المتصل إلى إعادة الربط.',
  BRAND_ARCHIVED: 'هذه العلامة مؤرشفة، لذلك توقف النشر.',
  NOT_APPROVED: 'النشر ينتظر حتى يكتمل اعتماد المنشور.',
  WORKDRIVE: 'تخزين الوسائط غير متاح. تحقق من WorkDrive ثم حاول مجددًا.',
  PROVIDER_REJECTED: 'رفضت الشبكة هذا المنشور. تحقق من صلاحيات الحساب ثم حاول مجددًا.',
  UNKNOWN: 'فشل النشر. تحقق من الحساب المتصل ثم حاول مجددًا.',
};

const TIKTOK_FAILURE_COPY: Record<string, { en: string; ar: string }> = {
  url_ownership_unverified: {
    en: 'TikTok has not verified the OMA media URL domain/prefix. Verify the exact public media proxy domain in the TikTok developer app.',
    ar: 'لم يوثّق TikTok نطاق أو مسار روابط وسائط OMA. وثّق نطاق وسيط الوسائط العام نفسه في إعدادات تطبيق TikTok للمطورين.',
  },
  scope_not_authorized: {
    en: 'The TikTok app/user grant lacks video.publish. Get the scope approved in TikTok Developer settings, then reconnect the account.',
    ar: 'تطبيق TikTok أو تفويض المستخدم لا يتضمن video.publish. اطلب اعتماد الصلاحية من إعدادات المطورين ثم أعد ربط الحساب.',
  },
  scope_missing: {
    en: 'The TikTok app/user grant lacks video.publish. Get the scope approved in TikTok Developer settings, then reconnect the account.',
    ar: 'تطبيق TikTok أو تفويض المستخدم لا يتضمن video.publish. اطلب اعتماد الصلاحية من إعدادات المطورين ثم أعد ربط الحساب.',
  },
  access_token_invalid: {
    en: 'The TikTok access token is invalid or expired. Reconnect the TikTok account.',
    ar: 'رمز وصول TikTok غير صالح أو منتهي الصلاحية. أعد ربط حساب TikTok.',
  },
  privacy_level_option_mismatch: {
    en: 'The configured privacy level is not available for this creator account. Choose a privacy level returned by TikTok Creator Info.',
    ar: 'مستوى الخصوصية المضبوط غير متاح لحساب المنشئ. استخدم أحد المستويات التي يعيدها TikTok Creator Info.',
  },
  video_size_check_failed: {
    en: 'TikTok video files must not exceed 4 GB.',
    ar: 'يجب ألا يتجاوز حجم ملف فيديو TikTok مقدار 4 غيغابايت.',
  },
  photo_count_exceeded: {
    en: 'TikTok photo posts accept up to 35 photos.',
    ar: 'تقبل منشورات صور TikTok ما يصل إلى 35 صورة.',
  },
  video_count_exceeded: {
    en: 'TikTok accepts one video per post. Create a separate post for each additional video.',
    ar: 'يقبل TikTok فيديو واحدًا في المنشور. أنشئ منشورًا منفصلًا لكل فيديو إضافي.',
  },
  invalid_media_combination: {
    en: 'TikTok does not allow photos and videos in the same post. Create a photo post or a video post.',
    ar: 'لا يسمح TikTok بخلط الصور والفيديوهات في المنشور نفسه. أنشئ منشور صور أو منشور فيديو.',
  },
  file_format_check_failed: {
    en: 'TikTok rejected the file format or video codec. Photos must be JPEG/WebP; videos must be MP4, WebM, or MOV using a supported codec.',
    ar: 'رفض TikTok صيغة الملف أو ترميز الفيديو. الصور يجب أن تكون JPEG أو WebP، والفيديو MP4 أو WebM أو MOV بترميز مدعوم.',
  },
  duration_check_failed: {
    en: 'The video does not meet the duration requirements for this TikTok creator account.',
    ar: 'مدة الفيديو لا تستوفي متطلبات حساب TikTok هذا.',
  },
  frame_rate_check_failed: {
    en: 'TikTok accepts video frame rates from 23 to 60 FPS.',
    ar: 'يقبل TikTok معدل إطارات للفيديو من 23 إلى 60 إطارًا في الثانية.',
  },
  picture_size_check_failed: {
    en: 'TikTok rejected the photo size or dimensions. Use JPEG/WebP, at most 20 MB per photo and no larger than 1080p.',
    ar: 'رفض TikTok حجم الصورة أو أبعادها. استخدم JPEG أو WebP بحجم لا يتجاوز 20 ميغابايت للصورة ودقة لا تتجاوز 1080p.',
  },
  video_pull_failed: {
    en: 'TikTok could not download the video from the public media URL. Check that the URL is reachable and the verified domain/prefix is configured.',
    ar: 'تعذر على TikTok تنزيل الفيديو من رابط الوسائط العام. تحقق من إمكانية الوصول إلى الرابط ومن توثيق النطاق أو المسار في إعدادات TikTok.',
  },
  photo_pull_failed: {
    en: 'TikTok could not download the photo from the public media URL. Check that the URL is reachable and the verified domain/prefix is configured.',
    ar: 'تعذر على TikTok تنزيل الصورة من رابط الوسائط العام. تحقق من إمكانية الوصول إلى الرابط ومن توثيق النطاق أو المسار في إعدادات TikTok.',
  },
  internal: {
    en: 'TikTok reported a temporary processing error. The publish status will be checked again.',
    ar: 'أبلغ TikTok عن خطأ معالجة مؤقت. ستتم إعادة التحقق من حالة النشر.',
  },
};

export function humanizePublishError(
  raw: string | null | undefined,
  locale: 'en' | 'ar' = 'en',
): string {
  const code = classifyPublishError(raw);
  const tikTokReason = /tiktok\s*\[([a-z0-9_]+)\]/i.exec(raw ?? '')?.[1]?.toLowerCase();
  const specific = tikTokReason ? TIKTOK_FAILURE_COPY[tikTokReason] : undefined;
  const base = specific ? specific[locale] : locale === 'ar' ? AR[code] : EN[code];
  const detail = providerDetail(raw);
  if (!detail || code === 'NOT_APPROVED') return base;
  return locale === 'ar'
    ? `${base}\nتفاصيل المزود: ${detail}`
    : `${base}\nProvider details: ${detail}`;
}

export type PublishSkipCode = 'NOT_APPROVED' | 'NO_ACCOUNT' | 'ENCRYPTION_KEY' | 'OTHER';

export function skipReasonMessage(code: PublishSkipCode, detail?: string): string {
  switch (code) {
    case 'NOT_APPROVED':
      return 'Skipped: post is not fully approved (policy requires approval before publish)';
    case 'NO_ACCOUNT':
      return 'Skipped: no publishing account attached';
    case 'ENCRYPTION_KEY':
      return 'Skipped: SOCIAL_TOKEN_ENCRYPTION_KEY is not configured on the worker';
    default:
      return detail ? `Skipped: ${detail}` : 'Skipped';
  }
}
