'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  CloseOutlined,
  DownOutlined,
  FileTextOutlined,
  FlagOutlined,
  PlusOutlined,
  SearchOutlined,
  TagOutlined,
} from '../ui/lucide-icons';
import { pickCopy } from '../../lib/demo/use-demo-api';

const LABEL_COLORS = [
  '#1677ff',
  '#52c41a',
  '#fa8c16',
  '#eb2f96',
  '#722ed1',
  '#13c2c2',
  '#f5222d',
  '#595959',
];

export type ComposeMetaCampaign = {
  id: string;
  name?: { en?: string; ar?: string } | string;
  track?: string;
};

export type ComposeMetaLabel = {
  id: string;
  color?: string | null;
  name?: { en?: string; ar?: string };
};

export type ComposeMetaTemplate = {
  id: string;
  name?: { en?: string; ar?: string };
  title?: { en?: string; ar?: string } | null;
  channel?: string;
};

function campaignName(c: ComposeMetaCampaign, locale: string) {
  if (typeof c.name === 'string') return c.name;
  return pickCopy(c.name, locale);
}

function templateLabel(tpl: ComposeMetaTemplate, ar: boolean) {
  const n = ar ? tpl.name?.ar || tpl.name?.en : tpl.name?.en || tpl.name?.ar;
  const t = ar ? tpl.title?.ar || tpl.title?.en : tpl.title?.en || tpl.title?.ar;
  return n || t || tpl.id;
}

export function ComposeMetaPills({
  locale,
  templates,
  campaigns,
  labels,
  selectedCampaignId,
  selectedLabels,
  brandName,
  onSelectCampaign,
  onToggleLabel,
  onCreateLabel,
  onApplyTemplate,
  onCreateTemplate,
  onOpenTemplates,
  onOpenLabels,
  testPrefix = 'demo-compose',
  testIds,
}: {
  locale: string;
  templates: ComposeMetaTemplate[];
  campaigns: ComposeMetaCampaign[];
  labels: ComposeMetaLabel[];
  selectedCampaignId?: string | null;
  selectedLabels: string[];
  brandName?: string;
  onSelectCampaign: (campaignId: string | null, track?: string) => void;
  onToggleLabel: (name: string) => void;
  onCreateLabel: (name: string, color: string) => void;
  onApplyTemplate: (tpl: ComposeMetaTemplate) => void;
  onCreateTemplate: () => void;
  onOpenTemplates?: () => void;
  onOpenLabels?: () => void;
  testPrefix?: string;
  testIds?: {
    templates?: string;
    templatesMenu?: string;
    campaign?: string;
    campaignMenu?: string;
    labels?: string;
    labelsMenu?: string;
  };
}) {
  const isAr = locale.toLowerCase().startsWith('ar');
  const wrapRef = useRef<HTMLDivElement>(null);
  const [campaignMenu, setCampaignMenu] = useState(false);
  const [labelMenu, setLabelMenu] = useState(false);
  const [templateMenu, setTemplateMenu] = useState(false);
  const [labelQuery, setLabelQuery] = useState('');
  const [labelDraft, setLabelDraft] = useState('');
  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setCampaignMenu(false);
        setLabelMenu(false);
        setTemplateMenu(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const shownLabels = labels.filter((lab) => {
    const q = labelQuery.trim().toLowerCase();
    if (!q) return true;
    return `${lab.name?.en ?? ''} ${lab.name?.ar ?? ''}`.toLowerCase().includes(q);
  });

  return (
    <div className="oma-compose-pills oma-compose-pills--inline" ref={wrapRef}>
      <div className="oma-compose-pill-wrap">
        <button
          type="button"
          className="oma-compose-pill"
          aria-expanded={templateMenu}
          onClick={() => {
            setTemplateMenu((v) => !v);
            setLabelMenu(false);
            setCampaignMenu(false);
            onOpenTemplates?.();
          }}
          data-testid={testIds?.templates ?? `${testPrefix}-templates`}
        >
          <FileTextOutlined />
          {isAr ? 'القوالب' : 'Templates'}
        </button>
        {templateMenu ? (
          <div
            className="oma-compose-flyout"
            role="dialog"
            data-testid={testIds?.templatesMenu ?? `${testPrefix}-templates-menu`}
          >
            <header className="oma-compose-flyout__head">
              <strong>{isAr ? 'تطبيق قالب منشور' : 'Apply post template'}</strong>
            </header>
            <div className="oma-compose-flyout__list">
              {templates.length === 0 ? (
                <p className="oma-compose-flyout__empty">
                  {isAr ? 'لا قوالب بعد في مساحة العمل' : 'No workspace templates yet'}
                </p>
              ) : (
                templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    className="oma-compose-flyout__row"
                    data-testid={`demo-template-${tpl.id}`}
                    onClick={() => {
                      onApplyTemplate(tpl);
                      setTemplateMenu(false);
                    }}
                  >
                    <span className="oma-compose-flyout__avatar" aria-hidden>
                      {templateLabel(tpl, isAr).slice(0, 1).toUpperCase()}
                    </span>
                    <span className="oma-compose-flyout__copy">{templateLabel(tpl, isAr)}</span>
                    <span className="oma-compose-flyout__chip">
                      {tpl.channel || brandName || (isAr ? 'بدون قناة' : 'No channel')}
                    </span>
                  </button>
                ))
              )}
            </div>
            <button
              type="button"
              className="oma-compose-flyout__create"
              onClick={() => {
                onCreateTemplate();
                setTemplateMenu(false);
              }}
            >
              <PlusOutlined /> {isAr ? 'إنشاء قالب جديد' : 'Create new template'}
            </button>
          </div>
        ) : null}
      </div>
      <div className="oma-compose-pill-wrap">
        <button
          type="button"
          className="oma-compose-pill"
          aria-expanded={campaignMenu}
          data-testid={testIds?.campaign ?? `${testPrefix}-campaign`}
          onClick={() => {
            setCampaignMenu((v) => !v);
            setLabelMenu(false);
            setTemplateMenu(false);
          }}
        >
          <FlagOutlined />
          {selectedCampaign ? campaignName(selectedCampaign, locale) : isAr ? 'الحملة' : 'Campaign'}
          <DownOutlined style={{ fontSize: 10 }} />
        </button>
        {campaignMenu ? (
          <div
            className="oma-compose-menu"
            role="menu"
            data-testid={testIds?.campaignMenu ?? `${testPrefix}-campaign-menu`}
          >
            <button
              type="button"
              className="oma-compose-menu__item"
              onClick={() => {
                onSelectCampaign(null);
                setCampaignMenu(false);
              }}
            >
              {isAr ? 'بدون حملة' : 'No campaign'}
            </button>
            {campaigns.map((c) => (
              <button
                key={c.id}
                type="button"
                className="oma-compose-menu__item"
                data-active={c.id === selectedCampaignId ? 'true' : 'false'}
                onClick={() => {
                  onSelectCampaign(c.id, c.track);
                  setCampaignMenu(false);
                }}
              >
                {campaignName(c, locale)}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="oma-compose-pill-wrap">
        <button
          type="button"
          className="oma-compose-pill"
          aria-expanded={labelMenu}
          onClick={() => {
            setLabelMenu((v) => !v);
            setTemplateMenu(false);
            setCampaignMenu(false);
            onOpenLabels?.();
          }}
          data-testid={testIds?.labels ?? `${testPrefix}-labels`}
        >
          <TagOutlined />
          {isAr ? 'التصنيفات' : 'Labels'}
          {selectedLabels.length ? (
            <span className="oma-compose-pill__count">{selectedLabels.length}</span>
          ) : null}
        </button>
        {labelMenu ? (
          <div
            className="oma-compose-flyout oma-compose-flyout--labels"
            role="dialog"
            data-testid={testIds?.labelsMenu ?? `${testPrefix}-labels-menu`}
          >
            <header className="oma-compose-flyout__head">
              <strong>{isAr ? 'إضافة تصنيفات' : 'Add labels'}</strong>
              <button
                type="button"
                className="oma-compose-flyout__close"
                aria-label={isAr ? 'إغلاق' : 'Close'}
                onClick={() => setLabelMenu(false)}
              >
                <CloseOutlined />
              </button>
            </header>
            <label className="oma-compose-flyout__search-wrap">
              <SearchOutlined />
              <input
                className="oma-compose-flyout__search"
                value={labelQuery}
                data-testid="demo-content-label-search"
                placeholder={isAr ? 'ابحث في التصنيفات…' : 'Search labels…'}
                onChange={(e) => setLabelQuery(e.target.value)}
              />
            </label>
            <div className="oma-compose-flyout__list">
              {shownLabels.length === 0 ? (
                <p className="oma-compose-flyout__empty">
                  {isAr ? 'لا تصنيفات بعد' : 'No labels yet'}
                </p>
              ) : (
                shownLabels.map((lab) => {
                  const name = lab.name?.en || lab.id;
                  const shown = isAr
                    ? lab.name?.ar || lab.name?.en || lab.id
                    : lab.name?.en || lab.name?.ar || lab.id;
                  const on = selectedLabels.includes(name);
                  return (
                    <label key={lab.id} className="oma-compose-label-row">
                      <input type="checkbox" checked={on} onChange={() => onToggleLabel(name)} />
                      <span
                        className="oma-plx-label-pill"
                        style={{ '--oma-label-tone': lab.color || '#06b6d4' } as CSSProperties}
                        data-label={shown}
                      >
                        {shown}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
            <div className="oma-compose-flyout__create-row">
              <input
                value={labelDraft}
                data-testid="demo-content-label-name"
                placeholder={isAr ? 'اسم التصنيف' : 'New label'}
                onChange={(e) => setLabelDraft(e.target.value)}
              />
              <button
                type="button"
                className="oma-compose-flyout__create"
                data-testid="demo-content-label-add"
                onClick={() => {
                  const name = labelDraft.trim() || labelQuery.trim();
                  if (!name) return;
                  onCreateLabel(name, LABEL_COLORS[labels.length % LABEL_COLORS.length]!);
                  setLabelDraft('');
                  setLabelQuery('');
                }}
              >
                <PlusOutlined /> {isAr ? 'إنشاء تصنيف جديد' : 'Create new label'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
