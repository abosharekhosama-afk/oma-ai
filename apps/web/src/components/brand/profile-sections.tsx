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

const SECTION_ORDER = [
  'overview',
  'brand',
  'catalog',
  'products',
  'contact',
  'languages',
  'claims',
  'risks',
];

function humanizeKey(key: string) {
  return key
    .replace(/[_.]/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * Field keys come from the domain, so fall back to a humanized key when a
 * profile carries a field the translation bundle does not know yet.
 */
function fieldLabel(t: (key: string) => string, fieldKey: string): string {
  const translated = t(`brand.field.${fieldKey}`);
  if (translated !== `brand.field.${fieldKey}`) return translated;
  return humanizeKey(fieldKey.split('.').slice(1).join(' ') || fieldKey);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.map((v) => formatValue(v)).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Section payloads are open-ended JSON from the profile builder, so render them
 * as labelled rows rather than exposing a raw JSON blob to reviewers.
 */
function SectionData({ label, value }: { label: string; value: unknown }) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return null;
  return (
    <div className="oma-profile-data">
      <h4 className="oma-profile-data-title">{label}</h4>
      <dl className="oma-profile-data-list">
        {entries.map(([k, v]) => (
          <div key={k} className="oma-profile-data-row">
            <dt>{humanizeKey(k)}</dt>
            <dd>{formatValue(v)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

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

  // Every section that carries either recorded data or a claim must render;
  // otherwise insights whose field prefix is outside SECTION_ORDER disappear.
  const knownKeys = new Set([...Object.keys(sections), ...insightsBySection.keys()]);
  const sectionKeys = [
    ...SECTION_ORDER.filter((k) => knownKeys.has(k)),
    ...[...knownKeys].filter((k) => !SECTION_ORDER.includes(k)).sort(),
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
          <SectionData label={t('brand.profile.sectionDataTitle')} value={sections[key]} />
          <ul className="oma-insight-list">
            {(insightsBySection.get(key) ?? []).map((insight) => (
              <li key={insight.id} className="oma-insight-item">
                <div className="oma-insight-header">
                  <strong>{fieldLabel(t, insight.field_key)}</strong>
                  <span className="oma-badge">{t(`brand.infoState.${insight.info_state}`)}</span>
                  <span className="oma-badge oma-badge-muted">
                    {t(`brand.tier.${insight.discovery_tier}`)}
                  </span>
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
