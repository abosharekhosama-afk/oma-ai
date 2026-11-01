'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { NetworkIcon } from './network-icon';
import {
  brandSettingsApi,
  SOCIAL_NETWORKS,
  type SocialNetwork,
  type SocialPageRow,
  type SocialProvider,
} from '../../lib/brand-settings-api';

const LABELS: Record<SocialNetwork, { en: string; ar: string }> = {
  facebook: { en: 'Facebook', ar: 'فيسبوك' },
  instagram: { en: 'Instagram', ar: 'إنستغرام' },
  linkedin: { en: 'LinkedIn', ar: 'لينكدإن' },
  tiktok: { en: 'TikTok', ar: 'تيك توك' },
  x: { en: 'X', ar: 'إكس' },
};
const CHANNEL_VALUES: Record<SocialNetwork, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  x: 'X',
};

function selectedSet(value: string) {
  return new Set(
    value
      .split(',')
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** One connected page per selected network (multi-channel publish targets). */
export function socialPageIdsForChannelSelection(
  pages: SocialPageRow[],
  channelValue: string,
): string[] {
  const selected = selectedSet(channelValue);
  const ids: string[] = [];
  for (const network of SOCIAL_NETWORKS) {
    if (!selected.has(network)) continue;
    const connected = pages.find((p) => p.network === network && p.status === 'CONNECTED');
    if (connected) ids.push(connected.id);
  }
  return ids;
}

export function ChannelChoiceCards({
  brandId,
  value,
  onChange,
  onSelectPage,
  onSelectPages,
  locale,
  multiple = false,
  variant = 'cards',
  filterQuery = '',
  testId = 'channel-choice-cards',
}: {
  brandId: string | null | undefined;
  value: string;
  onChange: (value: string) => void;
  onSelectPage?: (pageId: string | null) => void;
  /** When `multiple`, the connected page id per selected network. */
  onSelectPages?: (pageIds: string[]) => void;
  locale: string;
  multiple?: boolean;
  /** Planable compose uses a compact avatar strip; cards remain the default. */
  variant?: 'cards' | 'strip' | 'accounts';
  /** Case-insensitive filter for account name / handle / network (accounts variant). */
  filterQuery?: string;
  testId?: string;
}) {
  const isAr = locale.toLowerCase().startsWith('ar');
  const [pages, setPages] = useState<SocialPageRow[]>([]);
  const [providers, setProviders] = useState<SocialProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setPages([]);
    setProviders([]);
    setLoadFailed(false);
    if (!brandId) return;
    setLoading(true);
    brandSettingsApi
      .social(brandId)
      .then((r) => {
        if (!active) return;
        setPages(r.data.pages);
        setProviders(r.data.providers);
      })
      .catch(() => {
        if (active) {
          setPages([]);
          setProviders([]);
          setLoadFailed(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [brandId]);

  const lastPageIdsKey = useRef('');
  useEffect(() => {
    if (!multiple || !onSelectPages || loading || !pages.length) return;
    const ids = socialPageIdsForChannelSelection(pages, value);
    const key = ids.join(',');
    if (lastPageIdsKey.current === key) return;
    lastPageIdsKey.current = key;
    onSelectPages(ids);
  }, [multiple, onSelectPages, loading, pages, value]);

  const selected = selectedSet(value);
  const toggle = (network: SocialNetwork) => {
    const next = new Set(selected);
    const wasSelected = next.has(network);
    if (wasSelected) next.delete(network);
    else if (multiple) next.add(network);
    else {
      next.clear();
      next.add(network);
    }
    const channelStr = [...next]
      .map((key) => CHANNEL_VALUES[key as SocialNetwork] ?? key)
      .join(', ');
    onChange(channelStr);
    if (multiple) {
      onSelectPages?.(socialPageIdsForChannelSelection(pages, channelStr));
    } else {
      onSelectPage?.(
        wasSelected
          ? null
          : (pages.find((page) => page.network === network && page.status === 'CONNECTED')?.id ??
              null),
      );
    }
  };
  const settingsHref = brandId ? `/app/brands/${brandId}/settings?tab=accounts` : '/app/brands';

  if (variant === 'strip') {
    const stripNets = SOCIAL_NETWORKS.filter((network) => {
      const accounts = pages.filter((page) => page.network === network);
      return accounts.length > 0 || selected.has(network);
    });
    const show = stripNets.length ? stripNets : SOCIAL_NETWORKS;
    return (
      <div className="oma-channel-strip" data-testid={testId} role={multiple ? 'group' : 'radiogroup'}>
        {show.map((network) => {
          const accounts = pages.filter((page) => page.network === network);
          const connected = accounts.some((page) => page.status === 'CONNECTED');
          const page = accounts.find((p) => p.status === 'CONNECTED') ?? accounts[0];
          const isSelected = selected.has(network);
          const name = page?.name || LABELS[network][isAr ? 'ar' : 'en'];
          return (
            <button
              key={network}
              type="button"
              className="oma-channel-strip__item"
              role={multiple ? 'checkbox' : 'radio'}
              aria-checked={isSelected}
              aria-label={name}
              title={name}
              data-selected={isSelected ? 'true' : 'false'}
              data-connected={connected ? 'true' : 'false'}
              disabled={loading}
              onClick={() => toggle(network)}
            >
              <span className="oma-channel-strip__avatar" aria-hidden>
                {page?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={page.avatar_url} alt="" />
                ) : (
                  <span className="oma-channel-strip__initial">
                    {(page?.name || LABELS[network].en).slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="oma-channel-strip__badge">
                  <NetworkIcon channel={network} size={10} />
                </span>
              </span>
            </button>
          );
        })}
        <Link
          href={settingsHref}
          className="oma-channel-strip__add"
          aria-label={isAr ? 'إدارة القنوات' : 'Manage channels'}
          title={isAr ? 'إدارة القنوات' : 'Manage channels'}
        >
          +
        </Link>
      </div>
    );
  }

  if (variant === 'accounts') {
    const q = filterQuery.trim().toLowerCase();
    const rows = pages
      .filter((page) => page.status !== 'DISCONNECTED')
      .filter((page) => {
        if (!q) return true;
        const handle = page.external_id ? `@${page.external_id}` : '';
        const hay = `${page.name} ${handle} ${page.network}`.toLowerCase();
        return hay.includes(q);
      });
    return (
      <div className="oma-channel-accounts" data-testid={testId} role="group">
        {loading ? (
          <p className="oma-channel-accounts__empty">{isAr ? 'جارٍ التحميل…' : 'Loading…'}</p>
        ) : null}
        {!loading && !rows.length ? (
          <p className="oma-channel-accounts__empty">
            {isAr ? 'لا توجد حسابات متصلة' : 'No connected accounts'}
          </p>
        ) : null}
        {rows.map((page) => {
          const netSelected = selected.has(page.network);
          const handle = page.external_id ? `@${page.external_id}` : '';
          return (
            <button
              key={page.id}
              type="button"
              className="oma-channel-accounts__row"
              role="checkbox"
              aria-checked={netSelected}
              data-on={netSelected ? 'true' : 'false'}
              onClick={() => toggle(page.network)}
            >
              <span className="oma-channel-accounts__av" aria-hidden>
                {page.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={page.avatar_url} alt="" />
                ) : (
                  <span>{(page.name || '?').slice(0, 1).toUpperCase()}</span>
                )}
                <span className="oma-channel-accounts__badge">
                  <NetworkIcon channel={page.network} size={10} />
                </span>
              </span>
              <span className="oma-channel-accounts__meta">
                <strong>{page.name}</strong>
                {handle ? <span className="oma-ltr">{handle}</span> : null}
              </span>
              <span className="oma-channel-accounts__check" aria-hidden>
                {netSelected ? '✓' : ''}
              </span>
            </button>
          );
        })}
        <Link href={settingsHref} className="oma-channel-accounts__manage">
          {isAr ? 'إدارة القنوات' : 'Manage channels'}
        </Link>
      </div>
    );
  }


  return (
    <div className="oma-channel-choice" data-testid={testId}>
      <div className="oma-channel-choice__grid" role={multiple ? 'group' : 'radiogroup'}>
        {SOCIAL_NETWORKS.map((network) => {
          const accounts = pages.filter((page) => page.network === network);
          const connectedAccounts = accounts.filter((page) => page.status === 'CONNECTED');
          const needsReauth = accounts.some((page) => page.status === 'NEEDS_REAUTH');
          const provider = providers.find((item) => item.network === network);
          const isSelected = selected.has(network);
          const connected = connectedAccounts.length > 0;
          const name = LABELS[network][isAr ? 'ar' : 'en'];
          const stateText = loading
            ? isAr
              ? 'جارٍ التحقق…'
              : 'Checking…'
            : loadFailed
              ? isAr
                ? 'تعذر التحقق من الاتصال'
                : 'Could not check connection'
              : connected
                ? `${connectedAccounts.length} ${isAr ? 'حساب متصل' : connectedAccounts.length === 1 ? 'account connected' : 'accounts connected'}`
                : needsReauth
                  ? isAr
                    ? 'تحتاج إعادة تسجيل الدخول'
                    : 'Re-authentication needed'
                  : provider && !provider.available
                    ? isAr
                      ? 'الموصل غير مهيأ'
                      : 'Connector not configured'
                    : isAr
                      ? 'لا يوجد حساب متصل'
                      : 'No account connected';
          return (
            <button
              key={network}
              type="button"
              className="oma-channel-choice__card"
              role={multiple ? 'checkbox' : 'radio'}
              aria-checked={isSelected}
              data-selected={isSelected ? 'true' : 'false'}
              data-connected={connected ? 'true' : 'false'}
              onClick={() => toggle(network)}
            >
              <span className="oma-channel-choice__icon" aria-hidden>
                <NetworkIcon channel={network} size={18} />
              </span>
              <span className="oma-channel-choice__body">
                <strong>{name}</strong>
                <span className="oma-channel-choice__status">{stateText}</span>
                {accounts.length ? (
                  <span
                    className="oma-channel-choice__account"
                    title={accounts.map((p) => `${p.name} (${p.status})`).join(', ')}
                  >
                    {accounts
                      .slice(0, 2)
                      .map(
                        (page) =>
                          `${page.name}${page.status === 'CONNECTED' ? '' : ` · ${isAr ? 'إعادة ربط' : 'reauth'}`}`,
                      )
                      .join(', ')}
                    {accounts.length > 2 ? ` +${accounts.length - 2}` : ''}
                  </span>
                ) : null}
              </span>
              <span className="oma-channel-choice__check" aria-hidden>
                {isSelected ? '✓' : ''}
              </span>
            </button>
          );
        })}
      </div>
      <div className="oma-channel-choice__footer">
        <span>
          {isAr
            ? 'اختيار القناة لا ينشر المحتوى تلقائيًا.'
            : 'Selecting a channel does not publish automatically.'}
        </span>
        <Link href={settingsHref}>
          {isAr ? 'إدارة قنوات هذه العلامة' : 'Manage this brand’s channels'}
        </Link>
      </div>
    </div>
  );
}
