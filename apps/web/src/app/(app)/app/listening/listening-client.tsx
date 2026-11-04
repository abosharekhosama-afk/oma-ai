'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, Input } from '@oma/ui/controls';
import {
  createListeningRule,
  listListeningHits,
  listListeningRules,
  type ListeningHit,
  type ListeningRule,
} from '../../../../lib/listening-api';
import { useT } from '../../../../lib/use-locale';

function platformLabel(p: string) {
  const map: Record<string, string> = {
    META_FB: 'Facebook',
    META_IG: 'Instagram',
    TIKTOK: 'TikTok',
    LINKEDIN: 'LinkedIn',
  };
  return map[p] ?? p;
}

export function ListeningClient() {
  const t = useT();
  const [rules, setRules] = useState<ListeningRule[]>([]);
  const [hits, setHits] = useState<ListeningHit[]>([]);
  const [activeRuleId, setActiveRuleId] = useState<string | 'all' | 'priority'>('all');
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [keywords, setKeywords] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, h] = await Promise.all([
        listListeningRules(),
        listListeningHits(
          activeRuleId === 'priority'
            ? { highPriorityOnly: true, limit: 60 }
            : activeRuleId === 'all'
              ? { limit: 60 }
              : { ruleId: activeRuleId, limit: 60 },
        ),
      ]);
      setRules(r.items);
      setHits(h.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load listening');
    } finally {
      setLoading(false);
    }
  }, [activeRuleId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await createListeningRule({
        name: name.trim(),
        keywords: keywords
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        hashtags: hashtags
          .split(',')
          .map((s) => s.trim().replace(/^#/, ''))
          .filter(Boolean),
        isLive: true,
      });
      setName('');
      setKeywords('');
      setHashtags('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="oma-listening" data-testid="listening-page">
      <header className="oma-listening__head">
        <div>
          <h1>{t('nav.listening') || 'Social Listening'}</h1>
          <p className="oma-muted">
            Keyword and hashtag streams across connected platforms (TweetDeck-style columns).
          </p>
        </div>
      </header>

      {error ? (
        <p className="oma-inbox-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="oma-listening-create">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rule name" />
        <Input
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="Keywords (comma-separated)"
        />
        <Input
          value={hashtags}
          onChange={(e) => setHashtags(e.target.value)}
          placeholder="Hashtags (comma-separated)"
        />
        <Button type="primary" loading={creating} disabled={!name.trim()} onClick={() => void onCreate()}>
          Add stream
        </Button>
      </div>

      <div className="oma-listening-tabs" role="tablist">
        <button
          type="button"
          className={activeRuleId === 'all' ? 'is-active' : ''}
          onClick={() => setActiveRuleId('all')}
        >
          All hits
        </button>
        <button
          type="button"
          className={activeRuleId === 'priority' ? 'is-active' : ''}
          onClick={() => setActiveRuleId('priority')}
        >
          High priority
        </button>
        {rules.map((r) => (
          <button
            key={r.id}
            type="button"
            className={activeRuleId === r.id ? 'is-active' : ''}
            onClick={() => setActiveRuleId(r.id)}
          >
            {r.name}
            {!r.isLive ? ' (paused)' : ''}
          </button>
        ))}
      </div>

      <div className="oma-listening-board">
        {loading ? <div className="oma-inbox-empty">Loading…</div> : null}
        {!loading && hits.length === 0 ? (
          <div className="oma-inbox-empty">
            <strong>No mentions yet</strong>
            <p>
              Live rules poll platform search APIs when credentials are configured. Negative
              sentiment is flagged as high priority automatically.
            </p>
          </div>
        ) : null}
        <div className="oma-listening-columns">
          {hits.map((h) => (
            <article
              key={h.id}
              className={`oma-listening-card${h.isHighPriority ? ' is-priority' : ''}`}
              data-testid={`listening-hit-${h.id}`}
            >
              <header>
                <span className="oma-listening-card__plat">{platformLabel(h.platform)}</span>
                {h.sentiment ? (
                  <span className={`oma-listening-sent oma-listening-sent--${h.sentiment.toLowerCase()}`}>
                    {h.sentiment}
                  </span>
                ) : null}
              </header>
              <p className="oma-listening-card__author">
                {h.authorName || h.authorHandle || 'Unknown'}
              </p>
              <p className="oma-listening-card__body">{h.content}</p>
              {h.matchedKeywords.length ? (
                <div className="oma-inbox-chip-row">
                  {h.matchedKeywords.map((k) => (
                    <span key={k} className="oma-inbox-chip">
                      {k}
                    </span>
                  ))}
                </div>
              ) : null}
              <footer>
                <time dateTime={h.capturedAt}>{new Date(h.capturedAt).toLocaleString()}</time>
                {h.url ? (
                  <a href={h.url} target="_blank" rel="noreferrer">
                    Open
                  </a>
                ) : null}
              </footer>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
