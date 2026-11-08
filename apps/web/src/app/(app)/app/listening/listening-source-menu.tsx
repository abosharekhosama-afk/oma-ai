'use client';

import { useEffect, useRef, useState } from 'react';
import { DownOutlined } from '../../../../components/ui/lucide-icons';
import { useT } from '../../../../lib/use-locale';
import { LISTENING_PLATFORMS, platformLabel } from './listening-utils';

export function ListeningSourceMenu({
  selected,
  onChange,
}: {
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const allSelected = selected.size === 0;
  const label = allSelected
    ? t('listening.allPlatforms') || 'All platforms'
    : selected.size === 1
      ? platformLabel([...selected][0]!)
      : `${selected.size} platforms`;

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  return (
    <div className="oma-plx-listening-source" ref={rootRef}>
      <button
        type="button"
        className="oma-plx-listening-source__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>{t('listening.source') || 'Source'}:</span>
        <strong>{label}</strong>
        <DownOutlined />
      </button>
      {open ? (
        <div className="oma-plx-listening-source__menu" role="listbox">
          <label className="oma-plx-listening-source__row">
            <input type="checkbox" checked={allSelected} onChange={() => onChange(new Set())} />
            <span>{t('listening.allPlatforms') || 'All platforms'}</span>
          </label>
          {LISTENING_PLATFORMS.map((p) => (
            <label key={p.id} className="oma-plx-listening-source__row">
              <input
                type="checkbox"
                checked={!allSelected && selected.has(p.id)}
                onChange={() => {
                  if (allSelected) onChange(new Set([p.id]));
                  else toggle(p.id);
                }}
              />
              <span className="oma-plx-listening-source__plat" style={{ background: p.color }}>
                {p.short}
              </span>
              <span>{platformLabel(p.id)}</span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
