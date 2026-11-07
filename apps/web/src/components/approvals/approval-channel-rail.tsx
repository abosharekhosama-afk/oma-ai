'use client';

import { useMemo } from 'react';
import { NetworkIcon } from '../content/network-icon';
import { initials } from '../content/post-preview-model';
import { useT } from '../../lib/use-locale';

export type ApprovalChannelRow = {
  id: string;
  brandId: string;
  brandName: string;
  channel: string;
};

export function ApprovalChannelRail({
  channels,
  enabled,
  onToggle,
  onToggleAll,
}: {
  channels: ApprovalChannelRow[];
  enabled: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (on: boolean) => void;
}) {
  const t = useT();
  const allOn = enabled.size === 0 || enabled.size === channels.length;
  const someOn = enabled.size > 0 && enabled.size < channels.length;

  const grouped = useMemo(() => {
    const map = new Map<string, ApprovalChannelRow[]>();
    for (const ch of channels) {
      const list = map.get(ch.brandName) ?? [];
      list.push(ch);
      map.set(ch.brandName, list);
    }
    return [...map.entries()];
  }, [channels]);

  return (
    <aside className="oma-plx-approvals-channels" data-testid="approvals-channel-rail">
      <header className="oma-plx-approvals-channels__head">
        <strong>{t('approvals.channels')}</strong>
        <button
          type="button"
          className="oma-plx-approvals-channels__all"
          onClick={() => onToggleAll(!allOn)}
        >
          {allOn ? t('approvals.channels_clear') : t('approvals.channels_all')}
        </button>
      </header>
      <label className="oma-plx-approvals-channels__master">
        <input
          type="checkbox"
          checked={allOn}
          ref={(el) => {
            if (el) el.indeterminate = someOn;
          }}
          onChange={() => onToggleAll(!allOn)}
        />
        <span>{t('approvals.all_channels')}</span>
      </label>
      <ul className="oma-plx-approvals-channels__list">
        {grouped.map(([brandName, rows]) => (
          <li key={brandName} className="oma-plx-approvals-channels__brand">
            <div className="oma-plx-approvals-channels__brand-name">
              <span className="oma-plx-approvals-channels__avatar" aria-hidden>
                {initials(brandName)}
              </span>
              <span>{brandName}</span>
            </div>
            <ul>
              {rows.map((ch) => {
                const on = enabled.size === 0 || enabled.has(ch.id);
                return (
                  <li key={ch.id}>
                    <label className="oma-plx-approvals-channels__row">
                      <NetworkIcon channel={ch.channel} size={18} />
                      <span className="oma-plx-approvals-channels__row-label">{ch.channel}</span>
                      <input type="checkbox" checked={on} onChange={() => onToggle(ch.id)} />
                    </label>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </aside>
  );
}
