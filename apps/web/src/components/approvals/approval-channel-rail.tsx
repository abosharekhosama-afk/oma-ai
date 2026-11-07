'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { DownOutlined, EyeOutlined, FilterOutlined } from '../ui/lucide-icons';
import { NetworkIcon } from '../content/network-icon';
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
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const allOn = enabled.size === 0 || enabled.size === channels.length;
  const someOn = enabled.size > 0 && enabled.size < channels.length;
  const activeCount = allOn ? channels.length : enabled.size;

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

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
    <div className="oma-plx-approvals-ch-dd" ref={wrapRef} data-testid="approvals-channel-rail">
      <button
        type="button"
        className="oma-plx-approvals-ch-dd__trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        data-testid="approvals-channel-trigger"
      >
        <EyeOutlined className="oma-plx-approvals-ch-dd__eye" aria-hidden />
        <FilterOutlined className="oma-plx-approvals-ch-dd__filter" aria-hidden />
        <span>{t('approvals.channels')}</span>
        {!allOn ? (
          <span className="oma-plx-approvals-ch-dd__badge">
            {activeCount}/{channels.length}
          </span>
        ) : null}
        <DownOutlined className="oma-plx-approvals-ch-dd__chev" aria-hidden />
      </button>

      {open ? (
        <div
          className="oma-plx-approvals-channels"
          role="dialog"
          aria-label={t('approvals.channels')}
          data-testid="approvals-channel-popover"
        >
          <header className="oma-plx-approvals-channels__head">
            <strong>{t('approvals.channels')}</strong>
            <div className="oma-plx-approvals-channels__head-right">
              <button
                type="button"
                className="oma-plx-approvals-channels__all"
                onClick={() => onToggleAll(!allOn)}
              >
                {allOn ? t('approvals.channels_clear') : t('approvals.channels_all')}
              </button>
              <input
                type="checkbox"
                className="oma-plx-approvals-channels__check"
                checked={allOn}
                ref={(el) => {
                  if (el) el.indeterminate = someOn;
                }}
                onChange={() => onToggleAll(!allOn)}
                aria-label={t('approvals.all_channels')}
              />
            </div>
          </header>

          <ul className="oma-plx-approvals-channels__list">
            {grouped.map(([brandName, rows]) =>
              rows.map((ch) => {
                const on = enabled.size === 0 || enabled.has(ch.id);
                return (
                  <li key={ch.id}>
                    <label className="oma-plx-approvals-channels__row">
                      <NetworkIcon channel={ch.channel} size={18} />
                      <span className="oma-plx-approvals-channels__row-label">{brandName}</span>
                      <input
                        type="checkbox"
                        className="oma-plx-approvals-channels__check"
                        checked={on}
                        onChange={() => onToggle(ch.id)}
                      />
                    </label>
                  </li>
                );
              }),
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
