'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { CloseOutlined } from '../../../../components/ui/lucide-icons';
import {
  createListeningRule,
  getListeningSources,
  updateListeningRule,
  type ListeningRule,
  type ListeningSource,
} from '../../../../lib/listening-api';
import { useT } from '../../../../lib/use-locale';
import { LISTENING_PLATFORMS } from './listening-utils';

type Kind = 'BRAND' | 'TOPIC' | 'COMPETITOR';

function splitList(value: string) {
  return value
    .split(/[\n,]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function readinessKey(source: ListeningSource) {
  return `listening.readiness.${source.readiness}`;
}

function limitationKey(source: ListeningSource) {
  return `listening.limit.${source.limitation}`;
}

export function ListeningRulePanel({
  open,
  kind,
  brandName,
  brandId,
  rules,
  activeRuleId,
  canMutate,
  createOnOpen,
  onClose,
  onSelect,
  onSaved,
}: {
  open: boolean;
  kind: Kind;
  brandName: string;
  brandId?: string | null;
  rules: ListeningRule[];
  activeRuleId: string | null;
  canMutate: boolean;
  createOnOpen: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  onSaved: (id: string) => void;
}) {
  const t = useT();
  const titleId = useId();
  const rulesRef = useRef(rules);
  rulesRef.current = rules;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [keywords, setKeywords] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [note, setNote] = useState('');
  const [platforms, setPlatforms] = useState<Set<string>>(() => new Set());
  const [isLive, setIsLive] = useState(true);
  const [sources, setSources] = useState<ListeningSource[]>([]);
  const [channelsPath, setChannelsPath] = useState('/app/brands');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fill = (rule: ListeningRule | null) => {
    setEditingId(rule?.id ?? null);
    setName(rule?.name ?? (kind === 'BRAND' ? brandName : ''));
    setKeywords((rule?.keywords ?? []).join('\n'));
    setHashtags((rule?.hashtags ?? []).join('\n'));
    setNote(rule?.contextJson ?? '');
    setIsLive(rule?.isLive ?? true);
    const selected = rule?.platforms?.length
      ? rule.platforms
      : LISTENING_PLATFORMS.map((platform) => platform.id);
    setPlatforms(new Set(selected));
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void getListeningSources(brandId)
      .then((res) => {
        if (cancelled) return;
        setSources(res.sources);
        setChannelsPath(res.channelsPath);
      })
      .catch(() => {
        if (!cancelled) setSources([]);
      });
    const current = rulesRef.current;
    if (createOnOpen) fill(null);
    else fill(current.find((rule) => rule.id === activeRuleId) ?? current[0] ?? null);
    setError(null);
    return () => {
      cancelled = true;
    };
  }, [open, createOnOpen, activeRuleId, kind, brandId, brandName]);

  if (!open) return null;

  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const title =
    kind === 'TOPIC'
      ? t('listening.addTopic') || 'Add topic'
      : kind === 'COMPETITOR'
        ? t('listening.addCompetitor') || 'Add competitor'
        : t('listening.setup') || 'Set up monitoring';

  const save = async (live = isLive) => {
    if (!canMutate) return;
    setSaving(true);
    setError(null);
    const body = {
      name: name.trim(),
      keywords: splitList(keywords),
      hashtags: splitList(hashtags),
      platforms: [...platforms],
      isLive: live,
      contextJson: note.trim() || null,
      brandId: brandId || null,
    };
    try {
      if (editingId) {
        await updateListeningRule(editingId, body);
        onSaved(editingId);
      } else {
        const created = await createListeningRule({ ...body, kind });
        onSaved(created.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="oma-listening-panel-root">
      <button
        type="button"
        className="oma-listening-panel-backdrop"
        aria-label={t('listening.closePanel') || 'Close'}
        onClick={onClose}
      />
      <aside
        className="oma-listening-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="listening-rule-panel"
      >
        <header className="oma-listening-panel__head">
          <div>
            <p className="oma-listening-panel__brand">{brandName}</p>
            <h2 id={titleId}>{editingId ? name || title : title}</h2>
          </div>
          <button
            type="button"
            className="oma-listening-icon-btn"
            onClick={onClose}
            aria-label={t('listening.closePanel') || 'Close'}
            title={t('listening.closePanel') || 'Close'}
          >
            <CloseOutlined />
          </button>
        </header>
        <div className="oma-listening-panel__body">
          {rules.length ? (
            <ul className="oma-listening-panel__rules">
              {rules.map((rule) => (
                <li key={rule.id}>
                  <button
                    type="button"
                    className="oma-listening-panel__rule"
                    data-active={rule.id === (editingId ?? activeRuleId) ? 'true' : 'false'}
                    onClick={() => {
                      fill(rule);
                      onSelect(rule.id);
                    }}
                  >
                    <span>{rule.name}</span>
                    <small>
                      {rule.isLive
                        ? t('listening.status.active') || 'Active'
                        : t('listening.status.paused') || 'Paused'}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {canMutate && editingId ? (
            <button type="button" className="oma-listening-text-btn" onClick={() => fill(null)}>
              {kind === 'TOPIC'
                ? t('listening.addTopic') || 'Add topic'
                : kind === 'COMPETITOR'
                  ? t('listening.addCompetitor') || 'Add competitor'
                  : t('listening.addRule') || 'Add rule'}
            </button>
          ) : null}
          <label className="oma-listening-field">
            <span>
              {kind === 'BRAND'
                ? t('listening.field.ruleName') || 'Rule name'
                : t('listening.field.name') || 'Name'}
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              disabled={!canMutate}
            />
          </label>
          <label className="oma-listening-field">
            <span>{t('listening.field.aliases') || 'Aliases and keywords'}</span>
            <textarea
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              rows={4}
              disabled={!canMutate}
            />
          </label>
          <label className="oma-listening-field">
            <span>{t('listening.field.hashtags') || 'Hashtags'}</span>
            <textarea
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              rows={3}
              disabled={!canMutate}
            />
          </label>
          <fieldset className="oma-listening-field" disabled={!canMutate}>
            <legend>{t('listening.field.sources') || 'Data sources'}</legend>
            {LISTENING_PLATFORMS.map((platform) => {
              const meta = sourceById.get(platform.id);
              return (
                <label key={platform.id} className="oma-listening-source">
                  <input
                    type="checkbox"
                    checked={platforms.has(platform.id)}
                    onChange={(e) => {
                      setPlatforms((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(platform.id);
                        else next.delete(platform.id);
                        return next;
                      });
                    }}
                  />
                  <span>
                    <strong>{platform.id}</strong>
                    {meta ? (
                      <small>
                        {t(readinessKey(meta)) || meta.readiness}
                        {' · '}
                        {t(limitationKey(meta)) || meta.limitation}
                      </small>
                    ) : null}
                  </span>
                </label>
              );
            })}
            <a className="oma-listening-channels" href={channelsPath}>
              {t('listening.channelsLink') || 'Connect accounts in Channels'}
            </a>
          </fieldset>
          <label className="oma-listening-field">
            <span>{t('listening.field.note') || 'Note'}</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={500}
              disabled={!canMutate}
            />
            <small>
              {t('listening.noteHint') || 'Stored with the rule. It does not filter mentions.'}
            </small>
          </label>
          {error ? (
            <p className="oma-listening-panel__error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <footer className="oma-listening-panel__foot">
          {canMutate && editingId ? (
            <button
              type="button"
              className="oma-listening-text-btn"
              data-testid="listening-rule-pause"
              disabled={saving}
              onClick={() => void save(!isLive)}
            >
              {isLive ? t('listening.pause') || 'Pause' : t('listening.resume') || 'Resume'}
            </button>
          ) : (
            <span />
          )}
          {canMutate ? (
            <button
              type="button"
              className="oma-listening-save"
              data-testid="listening-rule-save"
              disabled={saving}
              onClick={() => void save(isLive)}
            >
              {saving ? t('listening.saving') || 'Saving…' : t('listening.save') || 'Save'}
            </button>
          ) : (
            <p>
              {t('listening.viewOnly') ||
                'You can view rules. Editing needs content update access.'}
            </p>
          )}
        </footer>
      </aside>
    </div>
  );
}
