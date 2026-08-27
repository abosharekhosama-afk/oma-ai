'use client';

import type { InsightItem } from '../../lib/brand-types';
import { useT } from '../../lib/use-locale';

type ProfileSectionsProps = {
  sections: Record<string, unknown>;
  insights: InsightItem[];
  editable: boolean;
  onInsightChange?: (insightId: string, text: string) => void;
  onViewEvidence?: (evidenceId: string) => void;
};

const SECTION_ORDER = ['overview', 'catalog', 'languages', 'claims', 'risks'];

export function ProfileSections({
  sections,
  insights,
  editable,
  onInsightChange,
  onViewEvidence,
}: ProfileSectionsProps) {
  const t = useT();
  const insightsBySection = new Map<string, InsightItem[]>();
  for (const insight of insights) {
    const section = insight.field_key.split('.')[0] ?? 'overview';
    const list = insightsBySection.get(section) ?? [];
    list.push(insight);
    insightsBySection.set(section, list);
  }

  const sectionKeys = [
    ...SECTION_ORDER.filter((k) => insightsBySection.has(k) || sections[k]),
    ...Object.keys(sections).filter((k) => !SECTION_ORDER.includes(k)),
  ];

  if (sectionKeys.length === 0) {
    return (
      <p className="oma-muted" role="status">
        {t('brand.profile.noSections')}
      </p>
    );
  }

  return (
    <div className="oma-profile-sections">
      {sectionKeys.map((key) => (
        <section
          key={key}
          className="oma-card oma-profile-section"
          aria-labelledby={`section-${key}`}
        >
          <h3 id={`section-${key}`}>{t(`brand.profile.section.${key}`) || key}</h3>
          {sections[key] ? (
            <pre className="oma-profile-json">{JSON.stringify(sections[key], null, 2)}</pre>
          ) : null}
          <ul className="oma-insight-list">
            {(insightsBySection.get(key) ?? []).map((insight) => (
              <li key={insight.id} className="oma-insight-item">
                <div className="oma-insight-header">
                  <strong>{insight.field_key}</strong>
                  <span className="oma-badge">{insight.info_state}</span>
                  <span className="oma-badge oma-badge-muted">{insight.discovery_tier}</span>
                </div>
                {editable ? (
                  <label className="oma-insight-edit">
                    <span className="oma-sr-only">{insight.field_key}</span>
                    <textarea
                      className="oma-input"
                      rows={2}
                      value={insight.text_value ?? ''}
                      onChange={(e) => onInsightChange?.(insight.id, e.target.value)}
                    />
                  </label>
                ) : (
                  <p>{insight.text_value ?? t('brand.profile.emptyValue')}</p>
                )}
                {insight.evidence_id ? (
                  <button
                    type="button"
                    className="oma-link-btn"
                    onClick={() => onViewEvidence?.(insight.evidence_id!)}
                  >
                    {t('brand.evidence.view')}
                  </button>
                ) : (
                  <p className="oma-muted" style={{ fontSize: 12 }}>
                    {t('brand.evidence.none')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
