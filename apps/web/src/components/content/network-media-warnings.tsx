'use client';

import {
  NETWORK_MEDIA_CONSTRAINTS,
  validateMediaForNetwork,
  type MediaAssetInfo,
  type SocialNetworkKey,
} from '@oma/domain/browser';

const NET_ALIASES: Record<string, SocialNetworkKey> = {
  tiktok: 'tiktok',
  instagram: 'instagram',
  facebook: 'facebook',
  linkedin: 'linkedin',
  x: 'x',
  twitter: 'x',
};

function resolveNetworks(channel: string, pageNetworks?: string[]): SocialNetworkKey[] {
  const out = new Set<SocialNetworkKey>();
  for (const n of pageNetworks ?? []) {
    const key = NET_ALIASES[String(n || '').toLowerCase()];
    if (key) out.add(key);
  }
  const ch = String(channel || '').toLowerCase();
  for (const [alias, key] of Object.entries(NET_ALIASES)) {
    if (ch.includes(alias)) out.add(key);
  }
  return [...out];
}

export function NetworkMediaWarnings(props: {
  locale: string;
  channel: string;
  pageNetworks?: string[];
  contentType?: string | null;
  media: Array<{ mime: string; size?: number; width?: number | null; height?: number | null }>;
}) {
  const isAr = props.locale.toLowerCase().startsWith('ar');
  const networks = resolveNetworks(props.channel, props.pageNetworks);
  if (!networks.length || !props.media.length) return null;

  const assets: MediaAssetInfo[] = props.media.map((m) => ({
    mime: m.mime,
    sizeBytes: m.size,
    width: m.width ?? null,
    height: m.height ?? null,
  }));

  const blocks: Array<{ network: SocialNetworkKey; notes: string; lines: string[] }> = [];
  for (const network of networks) {
    const issues = validateMediaForNetwork(network, assets, { contentType: props.contentType });
    const c = NETWORK_MEDIA_CONSTRAINTS[network];
    const lines = issues.map((i) => (isAr ? i.message.ar : i.message.en));
    if (lines.length || (c && (network === 'tiktok' || network === 'instagram'))) {
      blocks.push({
        network,
        notes: isAr ? c.notes.ar : c.notes.en,
        lines,
      });
    }
  }
  if (!blocks.length) return null;

  return (
    <div
      className="oma-compose-media-warnings"
      role="status"
      data-testid="compose-network-media-warnings"
      style={{
        margin: '8px 20px 0',
        padding: '10px 12px',
        borderRadius: 8,
        background: 'var(--oma-surface-muted, #f6f7f9)',
        border: '1px solid var(--oma-border, #e6e8ec)',
        fontSize: 12,
        lineHeight: 1.45,
      }}
    >
      {blocks.map((b) => (
        <div key={b.network} style={{ marginBottom: 6 }}>
          <strong style={{ textTransform: 'capitalize' }}>{b.network}</strong>
          <div className="oma-muted">{b.notes}</div>
          {b.lines.length ? (
            <ul style={{ margin: '4px 0 0', paddingInlineStart: 18 }}>
              {b.lines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
      <p className="oma-muted" style={{ margin: '6px 0 0' }}>
        {isAr
          ? 'سيحوّل الخادم الصور تلقائياً (مثلاً PNG→JPEG ويصغّرها إلى 1080p) قبل النشر عند الحاجة.'
          : 'The worker will auto-convert images (e.g. PNG→JPEG, max 1080p) before publishing when needed.'}
      </p>
    </div>
  );
}
