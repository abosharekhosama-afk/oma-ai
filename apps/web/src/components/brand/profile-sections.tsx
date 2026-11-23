'use client';
import { Button, TextArea } from '@oma/ui/controls';

import type { InsightItem } from '../../lib/brand-types';
import { formatInsightText, shortDisplayUrl } from '../../lib/profile-display';
import { groupInsightsByFieldAndValue } from '../../lib/brand-scan-ui';
import {
  bundleSourceUrl,
  bundleTitle,
  groupInsightsByEvidence,
  type EvidenceInsightBundle,
} from '../../lib/profile-insight-groups';
import { InsightRichValue } from './insight-rich-value';
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
  'tone',
  'audiences',
  'messaging',
  'visual_identity',
  'contact',
  'social',
  'languages',
  'claims',
  'risks',
  'evidence_refs',
];

function humanizeKey(key: string) {
  return key
    .replace(/[_.]/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}

export function fieldLabel(t: (key: string) => string, fieldKey: string): string {
  const translated = t(`brand.field.${fieldKey}`);
  if (translated !== `brand.field.${fieldKey}`) return translated;
  return humanizeKey(fieldKey.split('.').slice(1).join(' ') || fieldKey);
}

function formatValue(value: unknown, depth = 0): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '—';
    if (depth < 2 && (trimmed.startsWith('{') || trimmed.startsWith('['))) {
      const human = formatInsightText(trimmed);
      if (human !== trimmed) return human;
    }
    return trimmed;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const parts = value.map((v) => formatValue(v, depth + 1)).filter((p) => p !== '—');
    return parts.length ? parts.join(' · ') : '—';
  }
  if (typeof value === 'object' && depth < 2) {
    const rec = value as Record<string, unknown>;
    if (typeof rec.value === 'string') return rec.value.trim() || '—';
    if (typeof rec.label === 'string') return rec.label.trim() || '—';
    const entries = Object.entries(rec).filter(([, v]) => v != null && v !== '');
    if (entries.length === 0) return '—';
    return entries
      .slice(0, 6)
      .map(([k, v]) => `${humanizeKey(k)}: ${formatValue(v, depth + 1)}`)
      .join(' · ');
  }
  return String(value);
}

function colorList(value: unknown): string[] {
  if (!value || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  const raw = record.colors ?? record.theme ?? record.urls;
  if (Array.isArray(raw)) return raw.filter((item): item is string => typeof item === 'string');
  return [];
}

function VisualIdentity({ value }: { value: unknown }) {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const colors = colorList(record);
  const logos = Array.isArray(record.logos)
    ? record.logos.filter((item): item is string => typeof item === 'string')
    : [];
  const favicon = typeof record.favicon === 'string' ? record.favicon : null;
  const ogImage = typeof record.og_image === 'string' ? record.og_image : null;
  return (
    <div className="oma-profile-data" data-testid="visual-identity">
      {colors.length > 0 ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {colors.map((color) => (
            <span
              key={color}
              title={color}
              style={{
                width: 24,
                height: 24,
                borderRadius: 4,
                background: color,
                border: '1px solid var(--border-subtle, #d0d5dd)',
              }}
            />
          ))}
        </div>
      ) : null}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {[favicon, ogImage, ...logos]
          .filter(Boolean)
          .slice(0, 4)
          .map((src) => (
            <img
              key={src}
              src={src!}
              alt=""
              referrerPolicy="no-referrer"
              style={{ maxHeight: 48 }}
            />
          ))}
      </div>
    </div>
  );
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
  const i18nKey = `brand.profile.section.${key}`;
  const label = t(i18nKey);
  if (label === i18nKey || label.startsWith('brand.profile.section.')) {
    return humanizeKey(key);
  }
  return label;
}

function provenanceBadgeClass(infoState: string): string {
  if (infoState === 'AI_INFERRED') return 'oma-badge';
  if (infoState === 'OBSERVED') return 'oma-badge oma-badge-muted';
  return 'oma-badge oma-badge-muted';
}

function insightMetaChips(t: (key: string) => string, insight: InsightItem) {
  return (
    <>
      <span
        className={provenanceBadgeClass(insight.info_state)}
        data-testid={`insight-provenance-${insight.info_state}`}
      >
        {t(`brand.infoState.${insight.info_state}`)}
      </span>
      {insight.discovery_tier === 'REQUIRED_FOR_APPROVAL' ? (
        <span className="oma-badge oma-badge-muted">
          {t(`brand.tier.${insight.discovery_tier}`)}
        </span>
      ) : null}
    </>
  );
}

function InsightFieldRow({
  insight,
  editable,
  onInsightChange,
  t,
  compact,
}: {
  insight: InsightItem;
  editable: boolean;
  onInsightChange?: (id: string, text: string) => void;
  t: (key: string) => string;
  compact?: boolean;
}) {
  const empty = insight.text_value == null || String(insight.text_value).trim() === '';
  const required = insight.discovery_tier === 'REQUIRED_FOR_APPROVAL';
  return (
    <div
      className={`oma-insight-field-row${compact ? ' oma-insight-field-row--compact' : ''}`}
      data-field={insight.field_key}
    >
      <div className="oma-insight-field-row__label">
        <span>{fieldLabel(t, insight.field_key)}</span>
        {!compact ? (
          <span className="oma-insight-field-row__chips">{insightMetaChips(t, insight)}</span>
        ) : null}
      </div>
      {empty ? (
        <p className="oma-muted oma-insight-field-row__empty" role="status">
          {required ? t('brand.profile.requiredNotFound') : t('brand.profile.optionalUnknown')}
        </p>
      ) : editable ? (
        <label className="oma-insight-edit">
          <span className="oma-sr-only">{insight.field_key}</span>
          <TextArea
            rows={2}
            value={insight.text_value ?? ''}
            onChange={(e) => onInsightChange?.(insight.id, e.target.value)}
          />
        </label>
      ) : (
        <div className="oma-insight-field-row__value">
          <InsightRichValue insight={insight} />
        </div>
      )}
    </div>
  );
}

function EvidenceBundleCard({
  bundle,
  editable,
  onInsightChange,
  onViewEvidence,
  t,
}: {
  bundle: EvidenceInsightBundle;
  editable: boolean;
  onInsightChange?: (id: string, text: string) => void;
  onViewEvidence?: (evidenceId: string) => void;
  t: (key: string) => string;
}) {
  const title = bundleTitle(bundle.insights);
  const sourceUrl = bundleSourceUrl(bundle.insights);
  const primary = bundle.insights[0];
  return (
    <li className="oma-insight-bundle oma-plx-listening-card" data-testid="insight-evidence-bundle">
      <header className="oma-insight-bundle__head">
        <div className="oma-insight-bundle__titles">
          <h4 className="oma-insight-bundle__title" dir="auto">
            {title ?? fieldLabel(t, primary?.field_key ?? 'brand.name')}
          </h4>
          {sourceUrl ? (
            <a
              href={sourceUrl}
              className="oma-text-link oma-ltr oma-insight-bundle__source"
              target="_blank"
              rel="noreferrer noopener"
            >
              {shortDisplayUrl(sourceUrl, 72)}
            </a>
          ) : null}
        </div>
      </header>
      <dl className="oma-insight-bundle__fields">
        {bundle.insights.map((insight) => {
          if (insight.field_key === 'brand.name' && title) return null;
          if (insight.field_key === 'brand.source_url' && sourceUrl) return null;
          return (
            <div key={insight.id}>
              <InsightFieldRow
                insight={insight}
                editable={editable}
                onInsightChange={onInsightChange}
                t={t}
                compact
              />
            </div>
          );
        })}
      </dl>
      <footer className="oma-insight-footer">
        {bundle.evidenceId ? (
          <Button
            type="link"
            className="oma-insight-footer__evidence"
            onClick={() => onViewEvidence?.(bundle.evidenceId!)}
          >
            {t('brand.evidence.view')}
          </Button>
        ) : (
          <span className="oma-muted oma-insight-footer__dup">{t('brand.evidence.none')}</span>
        )}
      </footer>
    </li>
  );
}

function SingletonInsightCard({
  insight,
  dupCount,
  editable,
  onInsightChange,
  onViewEvidence,
  t,
}: {
  insight: InsightItem;
  dupCount: number;
  editable: boolean;
  onInsightChange?: (id: string, text: string) => void;
  onViewEvidence?: (evidenceId: string) => void;
  t: (key: string) => string;
}) {
  const isCatalog =
    insight.field_key === 'catalog.products' || insight.field_key === 'catalog.services';
  return (
    <li
      className={`oma-insight-item oma-plx-listening-card oma-plx-brand-insight-card${isCatalog ? ' oma-insight-item--catalog' : ''}`}
    >
      <InsightFieldRow
        insight={insight}
        editable={editable}
        onInsightChange={onInsightChange}
        t={t}
      />
      {!editable && isCatalog ? null : editable ? null : (
        <div className="oma-insight-footer">
          {dupCount > 0 ? (
            <span className="oma-muted oma-insight-footer__dup">
              {t('brand.profile.duplicateEvidence').replace('{count}', String(dupCount + 1))}
            </span>
          ) : null}
          {insight.evidence_id ? (
            <Button
              type="link"
              className="oma-insight-footer__evidence"
              onClick={() => onViewEvidence?.(insight.evidence_id!)}
            >
              {t('brand.evidence.view')}
            </Button>
          ) : (
            <span className="oma-muted oma-insight-footer__dup">{t('brand.evidence.none')}</span>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * Brand Intelligence editor: Planable section navigation + white editor surface.
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
    <div className="oma-stack oma-plx-brand-profile-canvas" data-testid="brand-intelligence-canvas">
      <div
        className="oma-plx-listening-panel oma-completeness-rail oma-completeness-rail--compact"
        data-testid="brand-profile-completeness"
      >
        <strong>
          {t('brand.profile.completeness')}: {pct}%
        </strong>
        <div className="oma-completeness-bar" aria-hidden>
          <span style={{ width: `${pct}%` }} />
        </div>
        <span className="oma-muted">
          {filled}/{insights.length || 0}
        </span>
        <p className="oma-muted oma-completeness-rail__hint">
          {t('brand.profile.completenessHint')}
        </p>
      </div>
      <div className="oma-doc-canvas oma-editor-shell oma-plx-brand-editor oma-doc-canvas--profile oma-doc-canvas--profile-single">
        <div className="oma-profile-sections oma-doc-main oma-doc-main--full">
          {sectionKeys.map((key) => (
            <section
              key={key}
              id={`section-${key}`}
              className="oma-doc-section oma-profile-section oma-plx-listening-panel"
              aria-labelledby={`heading-${key}`}
            >
              <h3 id={`heading-${key}`}>{sectionTitle(t, key)}</h3>
              {key === 'visual_identity' ? <VisualIdentity value={sections[key]} /> : null}
              {(insightsBySection.get(key) ?? []).length === 0 ? (
                <SectionData label={t('brand.profile.sectionDataTitle')} value={sections[key]} />
              ) : null}
              {(() => {
                const sectionInsights = insightsBySection.get(key) ?? [];
                const { bundles, singletons } = groupInsightsByEvidence(sectionInsights);
                const singletonGroups = groupInsightsByFieldAndValue(singletons);
                return (
                  <ul className="oma-insight-list oma-insight-list--spaced">
                    {bundles.map((bundle) => (
                      <EvidenceBundleCard
                        key={bundle.evidenceId ?? bundle.insights[0]?.id}
                        bundle={bundle}
                        editable={editable}
                        onInsightChange={onInsightChange}
                        onViewEvidence={onViewEvidence}
                        t={t}
                      />
                    ))}
                    {singletonGroups.map((group) => (
                      <SingletonInsightCard
                        key={group.primary.id}
                        insight={group.primary}
                        dupCount={group.duplicates.length}
                        editable={editable}
                        onInsightChange={onInsightChange}
                        onViewEvidence={onViewEvidence}
                        t={t}
                      />
                    ))}
                  </ul>
                );
              })()}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
