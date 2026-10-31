'use client';

import { humanizePublishError } from '../../lib/publish-errors';
import { publishTargetStateLabelKey, type PublishTargetStatusRow } from '../../lib/publish-status';
import { useT } from '../../lib/use-locale';

export function PublishTargetsPanel({
  targets,
  locale,
  testId = 'publish-targets-panel',
}: {
  targets: PublishTargetStatusRow[];
  locale: string;
  testId?: string;
}) {
  const t = useT();
  const isAr = locale.toLowerCase().startsWith('ar');
  if (!targets.length) return null;

  return (
    <ul className="oma-readiness-list oma-publish-targets" data-testid={testId}>
      {targets.map((target) => {
        const labelKey = publishTargetStateLabelKey(target.state);
        const err = target.lastError
          ? humanizePublishError(target.lastError, isAr ? 'ar' : 'en')
          : null;
        return (
          <li
            key={target.id}
            data-testid={`publish-target-${target.socialPageId}`}
            data-state={target.state}
          >
            <strong>{target.accountLabel || target.socialPageId}</strong>
            <span className="oma-muted"> · {t(labelKey)}</span>
            {target.externalPostUrl ? (
              <>
                {' · '}
                <a
                  href={target.externalPostUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="oma-text-link"
                >
                  {t('demo.schedule.viewPostLink')}
                </a>
              </>
            ) : null}
            {err && target.state.toUpperCase() === 'FAILED' ? (
              <span
                className="oma-muted"
                role="alert"
                data-testid={`publish-target-error-${target.socialPageId}`}
                style={{ display: 'block', whiteSpace: 'pre-line' }}
              >
                {err}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
