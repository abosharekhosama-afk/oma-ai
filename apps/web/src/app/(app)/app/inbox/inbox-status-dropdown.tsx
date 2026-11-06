'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckOutlined, UpOutlined } from '../../../../components/ui/lucide-icons';

export type InboxStatusFilter = 'OPEN' | 'PENDING' | 'CLOSED';
export type InboxPlatformFilter = 'all' | 'META_FB' | 'META_IG' | 'TIKTOK' | 'LINKEDIN';

type Option = { value: InboxStatusFilter; label: string; count?: number };
type ChannelOption = { value: InboxPlatformFilter; label: string };

export function InboxStatusDropdown({
  value,
  options,
  onChange,
  ariaLabel,
  platform,
  onPlatform,
  channelOptions,
  unanswered,
  onUnanswered,
  showUnanswered,
  unansweredLabel,
  statusLabel,
  channelsLabel,
}: {
  value: InboxStatusFilter;
  options: Option[];
  onChange: (v: InboxStatusFilter) => void;
  ariaLabel?: string;
  platform: InboxPlatformFilter;
  onPlatform: (v: InboxPlatformFilter) => void;
  channelOptions: ChannelOption[];
  unanswered: boolean;
  onUnanswered: (v: boolean) => void;
  showUnanswered: boolean;
  unansweredLabel: string;
  statusLabel: string;
  channelsLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value) ?? options[0]!;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="oma-plx-inbox-status-dd oma-plx-inbox-open-card" ref={ref}>
      <button
        type="button"
        className="oma-plx-inbox-status-dd__trigger"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={ariaLabel}
        data-testid="inbox-open-card-trigger"
        onClick={() => setOpen((v) => !v)}
      >
        <span>{current.label}</span>
        <UpOutlined className="oma-plx-inbox-status-dd__chev" />
      </button>
      {open ? (
        <div className="oma-plx-inbox-open-card__panel" role="dialog" data-testid="inbox-open-card">
          <section className="oma-plx-inbox-open-card__section">
            <h3>{statusLabel}</h3>
            <ul
              className="oma-plx-inbox-status-dd__menu oma-plx-inbox-status-dd__menu--in-card"
              role="listbox"
            >
              {options.map((o) => (
                <li key={o.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={o.value === value}
                    className={`oma-plx-inbox-status-dd__item${o.value === value ? ' is-selected' : ''}`}
                    onClick={() => onChange(o.value)}
                  >
                    <span className="oma-plx-inbox-status-dd__item-label">
                      {o.value === value ? (
                        <CheckOutlined />
                      ) : (
                        <span className="oma-plx-inbox-status-dd__check-spacer" />
                      )}
                      {o.label}
                    </span>
                    {o.count != null && o.count > 0 ? (
                      <span className="oma-plx-inbox-status-dd__count">{o.count}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section className="oma-plx-inbox-open-card__section">
            <h3>{channelsLabel}</h3>
            <div className="oma-plx-inbox-channels" data-testid="inbox-channel-filter">
              {channelOptions.map((ch) => (
                <button
                  key={ch.value}
                  type="button"
                  data-active={platform === ch.value ? 'true' : 'false'}
                  onClick={() => onPlatform(ch.value)}
                >
                  {ch.label}
                </button>
              ))}
            </div>
          </section>
          {showUnanswered ? (
            <section className="oma-plx-inbox-open-card__section">
              <label className="oma-plx-inbox-switch" data-testid="inbox-unanswered-switch">
                <input
                  type="checkbox"
                  checked={unanswered}
                  onChange={(e) => onUnanswered(e.target.checked)}
                />
                <span className="oma-plx-inbox-switch__track" aria-hidden />
                <span>{unansweredLabel}</span>
              </label>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
