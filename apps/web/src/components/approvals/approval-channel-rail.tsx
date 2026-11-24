'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FilterOutlined } from '../ui/lucide-icons';
import { NetworkIcon } from '../content/network-icon';
import { useT } from '../../lib/use-locale';
import { OmaIconAction } from '../ui/oma-icon-action';

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
  const [panelPos, setPanelPos] = useState<{ top: number; insetInlineStart: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const allOn = enabled.size === 0 || enabled.size === channels.length;
  const someOn = enabled.size > 0 && enabled.size < channels.length;
  const activeCount = allOn ? channels.length : enabled.size;

  useLayoutEffect(() => {
    if (!open || !wrapRef.current) {
      setPanelPos(null);
      return;
    }
    const r = wrapRef.current.getBoundingClientRect();
    const rtl = document.documentElement.getAttribute('dir') === 'rtl';
    const panelWidth = Math.min(236, window.innerWidth - 16);
    const margin = 8;
    const maxTop = window.innerHeight - Math.min(340, window.innerHeight - 128);
    let insetInlineStart: number;
    if (rtl) {
      const anchorEnd = window.innerWidth - r.right;
      insetInlineStart = Math.max(
        margin,
        Math.min(anchorEnd, window.innerWidth - panelWidth - margin),
      );
    } else {
      insetInlineStart = Math.max(margin, Math.min(r.left, window.innerWidth - panelWidth - margin));
    }
    const top = Math.min(r.bottom + 8, maxTop);
    setPanelPos({ top, insetInlineStart });
  }, [open, channels.length]);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
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

  const channelPanel =
    open && typeof document !== 'undefined' ? (
      <div
        ref={panelRef}
        className="oma-plx-approvals-channels oma-plx-approvals-channels--portal"
        role="dialog"
        aria-label={t('approvals.channels')}
        data-testid="approvals-channel-popover"
        style={
          panelPos
            ? {
                top: panelPos.top,
                insetInlineStart: panelPos.insetInlineStart,
              }
            : undefined
        }
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
    ) : null;

  return (
    <div className="oma-plx-approvals-ch-dd" ref={wrapRef} data-testid="approvals-channel-rail">
      <OmaIconAction
        type="button"
        className="oma-plx-approvals-ch-dd__trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={
          !allOn
            ? `${t('approvals.channels')} (${activeCount}/${channels.length})`
            : t('approvals.channels')
        }
        data-active={open ? 'true' : 'false'}
        badge={!allOn ? activeCount : undefined}
        onClick={() => setOpen((v) => !v)}
        data-testid="approvals-channel-trigger"
      >
        <FilterOutlined aria-hidden width={16} height={16} />
      </OmaIconAction>

      {channelPanel && typeof document !== 'undefined'
        ? createPortal(channelPanel, document.body)
        : null}
    </div>
  );
}
