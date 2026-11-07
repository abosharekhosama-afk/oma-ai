import { describe, expect, it } from 'vitest';
import { matchRequirements } from '../../apps/api/src/common/guards/capabilities.guard';
import {
  SYSTEM_PROFILES,
  buildListeningSourceCatalog,
  listeningSearchTerms,
  normalizeHashtag,
  safeListeningSyncError,
  validateListeningRuleWrite,
  ListeningRuleValidationError,
} from '@oma/domain';
import { pickRule, rulesOfKind } from '../../apps/web/src/app/(app)/app/listening/listening-utils';

const valid = {
  name: 'Brand mentions',
  kind: 'BRAND',
  keywords: ['OMA AI', ' oma ai '],
  hashtags: ['SocialOps', '#socialops'],
  platforms: ['REDDIT', 'META_IG'],
};

describe('listening rule management', () => {
  it('normalizes terms and requires a real source list', () => {
    const out = validateListeningRuleWrite(valid, 'create');
    expect(out.keywords).toEqual(['OMA AI']);
    expect(out.hashtags).toEqual(['#SocialOps']);
    expect(out.platforms).toEqual(['REDDIT', 'META_IG']);
  });

  it('rejects empty terms, unknown platforms, and blank names', () => {
    expect(() =>
      validateListeningRuleWrite({ ...valid, keywords: [], hashtags: [] }, 'create'),
    ).toThrow(ListeningRuleValidationError);
    expect(() =>
      validateListeningRuleWrite({ ...valid, platforms: ['MYSPACE'] }, 'create'),
    ).toThrow(ListeningRuleValidationError);
    expect(() => validateListeningRuleWrite({ ...valid, name: '  ' }, 'create')).toThrow(
      ListeningRuleValidationError,
    );
    expect(normalizeHashtag('##launch day')).toBe('#launchday');
    expect(normalizeHashtag('#launch!')).toBeNull();
  });

  it('searches each rule term instead of joining the first three', () => {
    expect(listeningSearchTerms(['Alpha', 'Beta', 'Gamma', 'Delta'], ['#Echo', 'alpha'])).toEqual([
      'Alpha',
      'Beta',
      'Gamma',
      'Delta',
      'Echo',
    ]);
  });

  it('stores sync failures as codes and drops credential-like text', () => {
    expect(
      safeListeningSyncError([
        'youtube:YOUTUBE_API_KEY_missing',
        'fb_tagged:token=secret-value',
        'web:GOOGLE_CSE_not_configured',
      ]),
    ).toBe('fb_tagged');
  });

  it('describes source readiness without accepting credential values', () => {
    const sources = buildListeningSourceCatalog({
      connectedNetworks: ['FACEBOOK'],
      youtubeConfigured: false,
      webConfigured: false,
    });
    const byId = Object.fromEntries(sources.map((source) => [source.id, source]));
    expect(byId.META_FB).toMatchObject({ readiness: 'configured', limitation: 'page_tags_only' });
    expect(byId.META_IG.readiness).toBe('needs_account');
    expect(byId.REDDIT.readiness).toBe('public');
    expect(byId.YOUTUBE.readiness).toBe('not_configured');
    expect(byId.WEB.readiness).toBe('not_configured');
    expect(byId.X).toMatchObject({
      readiness: 'needs_account',
      limitation: 'inbox_mentions_and_dms_not_global_search',
    });
    expect(byId.TIKTOK.mode).toBe('inbox_derived');
    expect(JSON.stringify(sources)).not.toMatch(/api[_-]?key|secret|token=/i);
  });

  it('keeps each kind on its own rules and does not fall back to another kind', () => {
    const rules = [
      { id: 'brand', kind: 'BRAND', name: 'Us' },
      { id: 'topic', kind: 'TOPIC', name: 'Topic' },
      { id: 'other', kind: 'COMPETITOR', name: 'Other' },
    ];
    expect(rulesOfKind(rules, 'TOPIC').map((rule) => rule.id)).toEqual(['topic']);
    expect(pickRule(rulesOfKind(rules, 'TOPIC'), 'missing')?.id).toBe('topic');
    expect(pickRule(rulesOfKind(rules, 'TOPIC'), 'topic')?.id).toBe('topic');
    expect(rulesOfKind(rules, 'BRAND')).toHaveLength(1);
    expect(pickRule([], null)).toBeNull();
  });

  it('lets readers view listening and requires content.update to change it', () => {
    expect(matchRequirements('GET', '/api/v1/listening/sources')).toEqual(['content.read']);
    expect(matchRequirements('GET', '/api/v1/listening/rules')).toEqual(['content.read']);
    expect(matchRequirements('POST', '/api/v1/listening/rules')).toEqual(['content.update']);
    expect(matchRequirements('POST', '/api/v1/listening/rules/rule_1')).toEqual(['content.update']);
    expect(matchRequirements('POST', '/api/v1/listening/sync')).toEqual(['content.update']);
    expect(SYSTEM_PROFILES.VIEWER).toContain('content.read');
    expect(SYSTEM_PROFILES.VIEWER).not.toContain('content.update');
    expect(SYSTEM_PROFILES.GUEST).not.toContain('content.update');
  });
});
