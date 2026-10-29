'use client';

import { useEffect, useState } from 'react';
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

export function ChannelChoiceCards({
  brandId,
  value,
  onChange,
  onSelectPage,
  locale,
  multiple = false,
  testId = 'channel-choice-cards',
}: {
  brandId: string | null | undefined;
  value: string;
  onChange: (value: string) => void;
  onSelectPage?: (pageId: string | null) => void;
  locale: string;
  multiple?: boolean;
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
    onChange([...next].map((key) => CHANNEL_VALUES[key as SocialNetwork] ?? key).join(', '));
    if (!multiple) {
      onSelectPage?.(
        wasSelected
          ? null
          : (pages.find((page) => page.network === network && page.status === 'CONNECTED')?.id ??
              null),
      );
    }
  };
  const settingsHref = brandId ? `/app/brands/${brandId}/settings?tab=accounts` : '/app/brands';

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
