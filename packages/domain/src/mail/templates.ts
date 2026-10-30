/**
 * Transactional email templates (pure functions, no vendor code).
 * Calm, neutral styling: white card, soft grey border, one solid button.
 * Arabic renders right-to-left.
 */

export type MailLocale = 'en' | 'ar';

export type RenderedMail = { subject: string; text: string; html: string };

export function pickMailLocale(...candidates: Array<string | null | undefined>): MailLocale {
  for (const c of candidates) {
    const v = (c ?? '').trim().toLowerCase();
    if (v.startsWith('ar')) return 'ar';
    if (v.startsWith('en')) return 'en';
  }
  return 'en';
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const FONT_EN =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const FONT_AR = "'Segoe UI', Tahoma, 'Noto Sans Arabic', Arial, sans-serif";

type Layout = {
  locale: MailLocale;
  preheader: string;
  heading: string;
  paragraphs: string[];
  ctaLabel: string;
  ctaUrl: string;
  fallbackLabel: string;
  footer: string[];
};

function layout(l: Layout): string {
  const rtl = l.locale === 'ar';
  const dir = rtl ? 'rtl' : 'ltr';
  const align = rtl ? 'right' : 'left';
  const font = rtl ? FONT_AR : FONT_EN;
  const paras = l.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3d4451;">${esc(p)}</p>`,
    )
    .join('');
  const footer = l.footer
    .map(
      (f) =>
        `<p style="margin:0 0 6px;font-size:12px;line-height:1.5;color:#8a919e;">${esc(f)}</p>`,
    )
    .join('');
  return `<!doctype html>
<html lang="${l.locale}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(l.heading)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f6f8;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(l.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f6f8;">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="${dir}" style="max-width:520px;font-family:${font};text-align:${align};">
<tr><td style="padding:0 4px 20px;font-size:18px;font-weight:700;color:#1f2430;letter-spacing:0.2px;">OMA</td></tr>
<tr><td style="background:#ffffff;border:1px solid #e3e6eb;border-radius:12px;padding:32px 32px 28px;">
<h1 style="margin:0 0 16px;font-size:21px;line-height:1.35;font-weight:600;color:#1f2430;">${esc(l.heading)}</h1>
${paras}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;"><tr>
<td style="border-radius:8px;background:#1f6feb;">
<a href="${esc(l.ctaUrl)}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${esc(l.ctaLabel)}</a>
</td></tr></table>
<p style="margin:0 0 6px;font-size:13px;line-height:1.5;color:#6b7280;">${esc(l.fallbackLabel)}</p>
<p style="margin:0;font-size:13px;line-height:1.5;word-break:break-all;" dir="ltr"><a href="${esc(l.ctaUrl)}" style="color:#1f6feb;text-decoration:underline;">${esc(l.ctaUrl)}</a></p>
</td></tr>
<tr><td style="padding:20px 4px 0;">${footer}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function textBody(
  heading: string,
  paragraphs: string[],
  ctaLabel: string,
  url: string,
  footer: string[],
) {
  return [
    heading,
    '',
    ...paragraphs.flatMap((p) => [p, '']),
    `${ctaLabel}:`,
    url,
    '',
    ...footer,
  ].join('\n');
}

export type InviteMailInput = {
  locale: MailLocale;
  acceptUrl: string;
  companyName?: string | null;
  inviterName?: string | null;
  expiresInDays?: number;
};

export function renderInviteEmail(input: InviteMailInput): RenderedMail {
  const days = input.expiresInDays ?? 7;
  const company = input.companyName?.trim() || null;
  const inviter = input.inviterName?.trim() || null;
  if (input.locale === 'ar') {
    const subject = company ? `دعوة للانضمام إلى ${company} على OMA` : 'دعوة للانضمام إلى OMA';
    const heading = company ? `انضم إلى ${company} على OMA` : 'لديك دعوة للانضمام إلى OMA';
    const lead = inviter
      ? company
        ? `دعاك ${inviter} للانضمام إلى فريق ${company} للعمل معًا على المحتوى والحملات.`
        : `دعاك ${inviter} للانضمام إلى فريقه على OMA.`
      : company
        ? `تمت دعوتك للانضمام إلى فريق ${company} للعمل معًا على المحتوى والحملات.`
        : 'تمت دعوتك للانضمام إلى فريق على OMA.';
    const paragraphs = [
      lead,
      `اضغط على الزر أدناه لقبول الدعوة. إن لم يكن لديك حساب بعد، أنشئ حسابًا بهذا البريد الإلكتروني نفسه. صلاحية الدعوة ${days} أيام.`,
    ];
    const footer = [
      'إذا لم تكن تتوقع هذه الدعوة، يمكنك تجاهل هذه الرسالة بأمان.',
      'OMA — منصة إدارة المحتوى والتسويق',
    ];
    const cta = 'قبول الدعوة';
    return {
      subject,
      html: layout({
        locale: 'ar',
        preheader: lead,
        heading,
        paragraphs,
        ctaLabel: cta,
        ctaUrl: input.acceptUrl,
        fallbackLabel: 'إذا لم يعمل الزر، انسخ هذا الرابط والصقه في متصفحك:',
        footer,
      }),
      text: textBody(heading, paragraphs, cta, input.acceptUrl, footer),
    };
  }
  const subject = company
    ? `You're invited to join ${company} on OMA`
    : "You're invited to join OMA";
  const heading = company ? `Join ${company} on OMA` : "You're invited to OMA";
  const lead = inviter
    ? company
      ? `${inviter} invited you to join the ${company} team to plan and approve content together.`
      : `${inviter} invited you to join their team on OMA.`
    : company
      ? `You've been invited to join the ${company} team to plan and approve content together.`
      : "You've been invited to join a team on OMA.";
  const paragraphs = [
    lead,
    `Select the button below to accept. If you don't have an account yet, sign up with this same email address. The invitation is valid for ${days} days.`,
  ];
  const footer = [
    "If you weren't expecting this invitation, you can safely ignore this email.",
    'OMA — content and marketing workspace',
  ];
  const cta = 'Accept invitation';
  return {
    subject,
    html: layout({
      locale: 'en',
      preheader: lead,
      heading,
      paragraphs,
      ctaLabel: cta,
      ctaUrl: input.acceptUrl,
      fallbackLabel: "If the button doesn't work, copy and paste this link into your browser:",
      footer,
    }),
    text: textBody(heading, paragraphs, cta, input.acceptUrl, footer),
  };
}

export type PasswordResetMailInput = { locale: MailLocale; resetUrl: string; name?: string | null };

export function renderPasswordResetEmail(input: PasswordResetMailInput): RenderedMail {
  const name = input.name?.trim() || null;
  if (input.locale === 'ar') {
    const subject = 'إعادة تعيين كلمة مرور OMA';
    const heading = 'إعادة تعيين كلمة المرور';
    const paragraphs = [
      name ? `مرحبًا ${name}،` : 'مرحبًا،',
      'تلقينا طلبًا لإعادة تعيين كلمة مرور حسابك على OMA. اضغط على الزر أدناه لاختيار كلمة مرور جديدة. صلاحية الرابط ساعة واحدة.',
    ];
    const footer = [
      'إذا لم تطلب ذلك، تجاهل هذه الرسالة وستبقى كلمة مرورك كما هي.',
      'OMA — منصة إدارة المحتوى والتسويق',
    ];
    const cta = 'تعيين كلمة مرور جديدة';
    return {
      subject,
      html: layout({
        locale: 'ar',
        preheader: 'رابط إعادة تعيين كلمة المرور صالح لمدة ساعة واحدة.',
        heading,
        paragraphs,
        ctaLabel: cta,
        ctaUrl: input.resetUrl,
        fallbackLabel: 'إذا لم يعمل الزر، انسخ هذا الرابط والصقه في متصفحك:',
        footer,
      }),
      text: textBody(heading, paragraphs, cta, input.resetUrl, footer),
    };
  }
  const subject = 'Reset your OMA password';
  const heading = 'Reset your password';
  const paragraphs = [
    name ? `Hi ${name},` : 'Hi,',
    'We received a request to reset the password for your OMA account. Select the button below to choose a new one. The link is valid for 1 hour.',
  ];
  const footer = [
    "If you didn't request this, ignore this email and your password will stay the same.",
    'OMA — content and marketing workspace',
  ];
  const cta = 'Choose a new password';
  return {
    subject,
    html: layout({
      locale: 'en',
      preheader: 'Your password reset link is valid for 1 hour.',
      heading,
      paragraphs,
      ctaLabel: cta,
      ctaUrl: input.resetUrl,
      fallbackLabel: "If the button doesn't work, copy and paste this link into your browser:",
      footer,
    }),
    text: textBody(heading, paragraphs, cta, input.resetUrl, footer),
  };
}

export function inviteAcceptLink(webOrigin: string, token: string): string {
  const origin = webOrigin.replace(/\/+$/, '').replace(/\/app$/i, '');
  return `${origin}/invite?token=${encodeURIComponent(token)}`;
}

export type PublishResultMailInput = {
  locale: MailLocale;
  outcome: 'succeeded' | 'failed';
  postTitle: string;
  postUrl?: string | null;
  errorMessage?: string | null;
  deepLinkUrl: string;
  name?: string | null;
};

export function renderPublishResultEmail(input: PublishResultMailInput): RenderedMail {
  const name = input.name?.trim() || null;
  const title = input.postTitle.trim() || (input.locale === 'ar' ? 'منشور' : 'Post');
  if (input.locale === 'ar') {
    if (input.outcome === 'succeeded') {
      const subject = `تم نشر «${title}»`;
      const heading = 'تم النشر بنجاح';
      const paragraphs = [
        name ? `مرحبًا ${name}،` : 'مرحبًا،',
        `نُشر المنشور «${title}» على الشبكة المتصلة.`,
        ...(input.postUrl ? [`رابط المنشور: ${input.postUrl}`] : []),
      ];
      const footer = ['OMA — منصة إدارة المحتوى والتسويق'];
      const cta = 'عرض في الجدولة';
      return {
        subject,
        html: layout({
          locale: 'ar',
          preheader: subject,
          heading,
          paragraphs,
          ctaLabel: cta,
          ctaUrl: input.deepLinkUrl,
          fallbackLabel: 'إذا لم يعمل الزر، انسخ هذا الرابط:',
          footer,
        }),
        text: textBody(heading, paragraphs, cta, input.deepLinkUrl, footer),
      };
    }
    const subject = `فشل نشر «${title}»`;
    const heading = 'فشل النشر';
    const paragraphs = [
      name ? `مرحبًا ${name}،` : 'مرحبًا،',
      `تعذّر نشر المنشور «${title}».`,
      input.errorMessage || 'تحقق من الحساب المتصل وحاول مجددًا.',
    ];
    const footer = ['OMA — منصة إدارة المحتوى والتسويق'];
    const cta = 'فتح الجدولة';
    return {
      subject,
      html: layout({
        locale: 'ar',
        preheader: subject,
        heading,
        paragraphs,
        ctaLabel: cta,
        ctaUrl: input.deepLinkUrl,
        fallbackLabel: 'إذا لم يعمل الزر، انسخ هذا الرابط:',
        footer,
      }),
      text: textBody(heading, paragraphs, cta, input.deepLinkUrl, footer),
    };
  }
  if (input.outcome === 'succeeded') {
    const subject = `Published “${title}”`;
    const heading = 'Published successfully';
    const paragraphs = [
      name ? `Hi ${name},` : 'Hi,',
      `“${title}” was published to the connected account.`,
      ...(input.postUrl ? [`Post link: ${input.postUrl}`] : []),
    ];
    const footer = ['OMA — content and marketing workspace'];
    const cta = 'View in schedule';
    return {
      subject,
      html: layout({
        locale: 'en',
        preheader: subject,
        heading,
        paragraphs,
        ctaLabel: cta,
        ctaUrl: input.deepLinkUrl,
        fallbackLabel: "If the button doesn't work, copy and paste this link:",
        footer,
      }),
      text: textBody(heading, paragraphs, cta, input.deepLinkUrl, footer),
    };
  }
  const subject = `Publishing failed for “${title}”`;
  const heading = 'Publishing failed';
  const paragraphs = [
    name ? `Hi ${name},` : 'Hi,',
    `We could not publish “${title}”.`,
    input.errorMessage || 'Check the connected account and try again.',
  ];
  const footer = ['OMA — content and marketing workspace'];
  const cta = 'Open schedule';
  return {
    subject,
    html: layout({
      locale: 'en',
      preheader: subject,
      heading,
      paragraphs,
      ctaLabel: cta,
      ctaUrl: input.deepLinkUrl,
      fallbackLabel: "If the button doesn't work, copy and paste this link:",
      footer,
    }),
    text: textBody(heading, paragraphs, cta, input.deepLinkUrl, footer),
  };
}
