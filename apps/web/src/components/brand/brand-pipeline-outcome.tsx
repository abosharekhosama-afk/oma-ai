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
    <section className="oma-panel oma-stack" data-testid="brand-pipeline-outcome">
      <h2>{t('brand.pipeline.title')}</h2>
      <p className="oma-muted">{t('brand.pipeline.subtitle')}</p>
      <p role="status">
        <strong>{t('brand.pipeline.endGoalLabel')}</strong> {endGoal}
      </p>
      <ol className="oma-discovery-list">
        {stages.map((stage) => (
          <li key={stage.id} className="oma-discovery-item" data-pipeline-state={stage.state}>
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
    </section>
  );
}
