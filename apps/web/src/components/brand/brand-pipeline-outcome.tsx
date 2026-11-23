'use client';

import Link from 'next/link';
import type { BrandPipelineHints } from '../../lib/brand-pipeline-hints';
import type { BrandDetail, ScanDetail } from '../../lib/brand-types';
import { buildBrandPipelineStages, pipelineEndGoal } from '../../lib/brand-pipeline-outcome';
import { useT } from '../../lib/use-locale';

export function BrandPipelineOutcome({
  brandId,
  brand,
  scan,
  hints,
}: {
  brandId: string;
  brand: BrandDetail;
  scan: ScanDetail | null;
  hints?: BrandPipelineHints | null;
}) {
  const t = useT();
  const stages = buildBrandPipelineStages(brandId, brand, scan, t, hints);
  const endGoal = pipelineEndGoal(t, brand, hints);

  return (
    <section className="oma-brand-pipeline-v2" data-testid="brand-pipeline-outcome">
      <header className="oma-brand-pipeline-v2__head">
        <div>
          <h3 className="oma-brand-pipeline-v2__title">{t('brand.pipeline.title')}</h3>
          <p className="oma-muted">{t('brand.pipeline.subtitle')}</p>
        </div>
        <p className="oma-brand-pipeline-v2__goal" role="status">
          <span className="oma-brand-pipeline-v2__goal-label">
            {t('brand.pipeline.endGoalLabel')}
          </span>{' '}
          {endGoal}
        </p>
      </header>
      <ol className="oma-brand-pipeline-v2__track">
        {stages.map((stage, index) => (
          <li
            key={stage.id}
            className="oma-brand-pipeline-v2__step"
            data-pipeline-state={stage.state}
            data-step={index + 1}
          >
            <span className="oma-brand-pipeline-v2__marker" aria-hidden />
            <h4 className="oma-brand-pipeline-v2__step-title">
              <Link href={stage.href} className="oma-text-link">
                {stage.label}
              </Link>
            </h4>
            <p className="oma-brand-pipeline-v2__step-detail">{stage.detail}</p>
            <span className="oma-brand-pipeline-v2__badge">
              {t(`brand.pipeline.state.${stage.state}`)}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}