'use client';

import { resolveContentWorkflow, type ApprovalPolicy, type PublishDisplay } from '@oma/demo';

const labels: Record<PublishDisplay, { en: string; ar: string }> = {
  DRAFT: { en: 'Draft', ar: 'مسودة' },
  APPROVAL_PENDING: { en: 'Approval pending', ar: 'بانتظار الاعتماد' },
  PARTIALLY_APPROVED: { en: 'Partially approved', ar: 'اعتماد جزئي' },
  APPROVED: { en: 'Approved', ar: 'معتمد' },
  PLANNED_DATE: { en: 'Planned date', ar: 'تاريخ مخطط' },
  SCHEDULED_LOCAL: { en: 'Scheduled in OMA', ar: 'مجدول في OMA' },
  PUBLISHING_NOT_CONNECTED: { en: 'Publishing not connected', ar: 'النشر غير متصل' },
  PUBLISHED_SAMPLE: { en: 'Published sample', ar: 'عينة منشورة' },
  FAILED_SAMPLE: { en: 'Failed sample', ar: 'عينة فشل' },
};

export function publishText(display: PublishDisplay, locale: string): string {
  const ar = locale.toLowerCase().startsWith('ar');
  return ar ? labels[display].ar : labels[display].en;
}

export function StatusMark({ display, locale }: { display: PublishDisplay; locale: string }) {
  const label = publishText(display, locale);
  return (
    <span
      className={`oma-status-mark oma-status-mark--${display}`}
      data-testid={`status-${display}`}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        {display === 'APPROVED' || display === 'SCHEDULED_LOCAL' ? (
          <path d="M2 6.2 4.6 9 10 3.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        ) : display === 'PARTIALLY_APPROVED' ? (
          <path d="M2 6h8M2 3.5h5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        ) : display === 'FAILED_SAMPLE' ? (
          <path d="M3 3l6 6M9 3 3 9" fill="none" stroke="currentColor" strokeWidth="1.5" />
        ) : (
          <circle cx="6" cy="6" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        )}
      </svg>
      <span>{label}</span>
    </span>
  );
}

export function ContentFace({
  variant,
  title,
  caption,
  channel,
  when,
  asset,
  display,
  locale,
  selected,
}: {
  variant: 'feed' | 'calendar' | 'saved' | 'grid' | 'list';
  title: string;
  caption: string;
  channel: string;
  when: string;
  asset: string;
  display: PublishDisplay;
  locale: string;
  selected?: boolean;
}) {
  return (
    <span
      className={`oma-post-card oma-post-card--${variant}`}
      data-selected={selected ? 'true' : 'false'}
      data-publish={display}
    >
      {variant !== 'list' ? (
        <img className="oma-post-card__media" src={asset} alt="" />
      ) : (
        <img className="oma-post-card__media oma-post-card__media--row" src={asset} alt="" />
      )}
      <span className="oma-post-card__title">{title}</span>
      {variant !== 'calendar' && variant !== 'saved' ? (
        <span className="oma-post-card__caption">{caption}</span>
      ) : null}
      <span className="oma-post-card__meta">
        <span>{channel}</span>
        <span className="oma-ltr">{when}</span>
      </span>
      <StatusMark display={display} locale={locale} />
    </span>
  );
}

export function faceDisplay(
  item: Parameters<typeof resolveContentWorkflow>[0],
  policy: ApprovalPolicy,
): PublishDisplay {
  return resolveContentWorkflow(item, policy).publishDisplay;
}
