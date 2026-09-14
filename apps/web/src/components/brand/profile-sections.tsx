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

function sectionTitle(t: (key: string) => string, key: string) {
  const label = t(`brand.profile.section.${key}`);
  return label.startsWith('brand.profile.section.') ? key.replace(/_/g, ' ') : label;
}

/**
 * Brand Intelligence canvas: sticky section outline + central editable document
 * (Jasper Brand IQ pattern adapted to OMA tokens — not a card stack).
 */
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

  const filled = insights.filter((i) => i.text_value && String(i.text_value).trim()).length;
  const total = Math.max(insights.length, 1);
  const pct = Math.round((filled / total) * 100);

  return (
    <div className="oma-stack" data-testid="brand-intelligence-canvas">
      <div className="oma-completeness-rail" data-testid="brand-profile-completeness">
        <strong>
          {t('brand.profile.completeness')}: {pct}%
        </strong>
        <div className="oma-completeness-bar" aria-hidden>
          <span style={{ width: `${pct}%` }} />
        </div>
        <span className="oma-muted">
          {filled}/{insights.length || 0}
        </span>
      </div>
      <div className="oma-doc-canvas">
        <nav className="oma-doc-outline" aria-label={t('brand.profile.outline')}>
          {sectionKeys.map((key) => (
            <a key={key} href={`#section-${key}`}>
              {sectionTitle(t, key)}
            </a>
          ))}
        </nav>
        <div className="oma-profile-sections oma-doc-main">
          {sectionKeys.map((key) => (
            <section
              key={key}
              id={`section-${key}`}
              className="oma-doc-section oma-profile-section"
              aria-labelledby={`heading-${key}`}
            >
              <h3 id={`heading-${key}`}>{sectionTitle(t, key)}</h3>
              <SectionData label={t('brand.profile.sectionDataTitle')} value={sections[key]} />
              <ul className="oma-insight-list">
                {(insightsBySection.get(key) ?? []).map((insight) => (
                  <li key={insight.id} className="oma-insight-item">
                    <div className="oma-insight-header">
                      <strong>{fieldLabel(t, insight.field_key)}</strong>
                      <span className="oma-badge">
                        {t(`brand.infoState.${insight.info_state}`)}
                      </span>
                      <span className="oma-badge oma-badge-muted">
                        {t(`brand.tier.${insight.discovery_tier}`)}
                      </span>
                    </div>
                    {(() => {
                      const empty =
                        insight.text_value == null || String(insight.text_value).trim() === '';
                      if (!empty) return null;
                      const required = insight.discovery_tier === 'REQUIRED_FOR_APPROVAL';
                      return (
                        <p
                          className="oma-muted"
                          role="status"
                          data-absence={required ? 'required-not-found' : 'optional-unknown'}
                        >
                          {required
                            ? t('brand.profile.requiredNotFound')
                            : t('brand.profile.optionalUnknown')}
                        </p>
                      );
                    })()}
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
      </div>
    </div>
  );
}
