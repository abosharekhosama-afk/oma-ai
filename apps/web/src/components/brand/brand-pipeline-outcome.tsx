'use client';

import Link from 'next/link';
import type { BrandDetail, ScanDetail } from '../../lib/brand-types';
import { buildBrandPipelineStages, pipelineEndGoal } from '../../lib/brand-pipeline-outcome';
import { useT } from '../../lib/use-locale';

export function BrandPipelineOutcome({
  brandId,
  brand,
  scan,
}: {
  brandId: string;
  brand: BrandDetail;
  scan: ScanDetail | null;
}) {
  const t = useT();
  const stages = buildBrandPipelineStages(brandId, brand, scan, t);
  const endGoal = pipelineEndGoal(t, brand);

  return (
    <section
      className="oma-plx-listening-panel oma-plx-brand-section"
      data-testid="brand-pipeline-outcome"
    >
      <header className="oma-plx-brand-section__head">
        <div>
          <h3 className="oma-plx-brand-section__title">{t('brand.pipeline.title')}</h3>
          <p className="oma-muted oma-plx-brand-section__desc">{t('brand.pipeline.subtitle')}</p>
        </div>
      </header>
      <div className="oma-plx-brand-section__body">
        <p className="oma-plx-listening__next-check" role="status">
          <strong>{t('brand.pipeline.endGoalLabel')}</strong> {endGoal}
        </p>
        <ol className="oma-plx-brand-data-grid">
          {stages.map((stage) => (
            <li
              key={stage.id}
              className="oma-plx-listening-card oma-plx-brand-catalog-card"
              data-pipeline-state={stage.state}
            >
              <div className="oma-title-row">
                <Link href={stage.href} className="oma-text-link">
                  {stage.label}
                </Link>
                <span className="oma-badge oma-badge-muted">
                  {t(`brand.pipeline.state.${stage.state}`)}
                </span>
              </div>
              <p className="oma-muted">{stage.detail}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
