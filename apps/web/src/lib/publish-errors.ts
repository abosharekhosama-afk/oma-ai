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
    test: (s) => /video\.publish|not authorized for this app|Enable Direct Post/i.test(s),
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
    test: (s) => /tiktok:|facebook:|instagram:|linkedin:|x:|provider|rejected|http \d{3}/i.test(s),
  },
];

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

function providerDetail(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim();
  if (!value) return null;
  // Adapter messages are redacted before persistence; keep provider diagnostics visible.
  return value.slice(0, 700);
}

export function humanizePublishError(
  raw: string | null | undefined,
  locale: 'en' | 'ar' = 'en',
): string {
  const code = classifyPublishError(raw);
  const base = locale === 'ar' ? AR[code] : EN[code];
  const detail = providerDetail(raw);
  if (!detail || code === 'NOT_APPROVED') return base;
  return locale === 'ar'
    ? `${base}\nتفاصيل الخادم: ${detail}`
    : `${base}\nServer details: ${detail}`;
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
