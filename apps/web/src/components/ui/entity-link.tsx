'use client';

import {
  CheckSquareOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  FlagOutlined,
  PictureOutlined,
  ShopOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { getCampaignProduction } from '../../lib/campaign-api';
import { getContentProduction } from '../../lib/content-api';
import { getDeliverable, getRequest, getTaskDetail } from '../../lib/ops-api';
import { useLocale, useT } from '../../lib/use-locale';

export type EntityType = 'campaign' | 'request' | 'content' | 'task' | 'deliverable' | 'brand';

type Copy = { en: string; ar: string } | string | null | undefined;

const ICONS: Record<EntityType, ReactNode> = {
  campaign: <FlagOutlined />,
  request: <FileTextOutlined />,
  content: <PictureOutlined />,
  task: <CheckSquareOutlined />,
  deliverable: <FileDoneOutlined />,
  brand: <ShopOutlined />,
};

const FETCHERS: Partial<Record<EntityType, (id: string) => Promise<Copy>>> = {
  campaign: async (id) => (await getCampaignProduction(id)).name,
  request: async (id) => (await getRequest(id)).data.title,
  content: async (id) => (await getContentProduction(id)).data.title,
  task: async (id) => (await getTaskDetail(id)).data.title,
  deliverable: async (id) => (await getDeliverable(id)).title,
};

/** Session cache so drawers re-opening the same record do not refetch names. */
const cache = new Map<string, Promise<Copy>>();

function fetchName(type: EntityType, id: string): Promise<Copy> {
  const key = `${type}:${id}`;
  let hit = cache.get(key);
  if (!hit) {
    const fn = FETCHERS[type];
    hit = fn ? fn(id).catch(() => null) : Promise.resolve(null);
    cache.set(key, hit);
  }
  return hit;
}

function copyText(copy: Copy, locale: string): string {
  if (!copy) return '';
  if (typeof copy === 'string') return copy.trim();
  const ar = locale.toLowerCase().startsWith('ar');
  return ((ar ? copy.ar : copy.en) || copy.en || copy.ar || '').trim();
}

/**
 * Link to a related record that shows the record's title/name with a type icon,
 * never the raw id. Falls back to the type label ("Request") while loading or
 * when the name cannot be resolved.
 */
export function EntityLink({
  type,
  id,
  href,
  name,
  className,
  testId,
  showType = true,
}: {
  type: EntityType;
  id: string;
  href: string;
  /** Known name — skips the fetch. */
  name?: Copy;
  className?: string;
  testId?: string;
  showType?: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const known = copyText(name, locale);
  const [resolved, setResolved] = useState<Copy>(null);

  useEffect(() => {
    if (known || !id) return;
    let alive = true;
    void fetchName(type, id).then((v) => {
      if (alive) setResolved(v);
    });
    return () => {
      alive = false;
    };
  }, [type, id, known]);

  const typeLabel = t(`entity.type.${type}`);
  const label = known || copyText(resolved, locale);
  return (
    <Link
      href={href}
      className={['oma-entity-link', className].filter(Boolean).join(' ')}
      data-testid={testId}
      data-entity-type={type}
      title={label ? `${typeLabel}: ${label}` : typeLabel}
    >
      <span className="oma-entity-link__icon" aria-hidden>
        {ICONS[type]}
      </span>
      {showType && label ? <span className="oma-entity-link__type">{typeLabel}</span> : null}
      <span className="oma-entity-link__label">{label || typeLabel}</span>
    </Link>
  );
}
