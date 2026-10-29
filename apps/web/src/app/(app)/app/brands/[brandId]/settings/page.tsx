'use client';
import { DetailShimmer } from '../../../../../../components/ui/shimmer';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PermissionDenied } from '../../../../../../components/shell/permission-denied';
import { ErrorState } from '../../../../../../components/ui/empty-state';
import {
  BrandSettingsView,
  type BrandSettingsTab,
} from '../../../../../../components/brand/brand-settings-view';
import {
  brandSettingsApi,
  readLogoFile,
  timezoneOptions,
  type BrandMemberCandidate,
  type BrandMemberRow,
  type SocialNetwork,
  type SocialPageRow,
  type SocialProvider,
} from '../../../../../../lib/brand-settings-api';
import type { BrandDetail } from '../../../../../../lib/brand-types';
import { getApiError, isPermissionDenied } from '../../../../../../lib/brand-api';
import { useT } from '../../../../../../lib/use-locale';
import { mediaApi } from '../../../../../../lib/workdrive-api';

const TABS: BrandSettingsTab[] = ['general', 'members', 'accounts'];
const CONNECT_RESULT = ['ok', 'cancelled', 'invalid', 'none', 'provider_error', 'error'];

export default function BrandSettingsPage() {
  const t = useT();
  const router = useRouter();
  const search = useSearchParams();
  const { brandId } = useParams<{ brandId: string }>();
  const initialTab = search.get('tab');
  const [tab, setTab] = useState<BrandSettingsTab>(
    TABS.includes(initialTab as BrandSettingsTab) ? (initialTab as BrandSettingsTab) : 'general',
  );
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error' | 'info'; text: string } | null>(
    null,
  );
  const [members, setMembers] = useState<BrandMemberRow[] | null>(null);
  const [candidates, setCandidates] = useState<BrandMemberCandidate[]>([]);
  const [pages, setPages] = useState<SocialPageRow[] | null>(null);
  const [providers, setProviders] = useState<SocialProvider[]>([]);
  const [connecting, setConnecting] = useState<SocialNetwork | null>(null);
  const timezones = useMemo(() => timezoneOptions(), []);
  const [logoStorage, setLogoStorage] = useState<{
    connected: boolean;
    orgName: string | null;
    canConnect: boolean;
  } | null>(null);

  const fail = useCallback(
    (e: unknown) => setNotice({ kind: 'error', text: getApiError(e).message }),
    [],
  );

  const loadBrand = useCallback(() => {
    brandSettingsApi
      .get(brandId)
      .then((r) => setBrand(r.data))
      .catch((e) => (isPermissionDenied(e) ? setDenied(true) : setError(getApiError(e).message)));
  }, [brandId]);
  const loadMembers = useCallback(() => {
    brandSettingsApi
      .members(brandId)
      .then((r) => {
        setMembers(r.data.members);
        setCandidates(r.data.available);
      })
      .catch((e) => {
        setMembers([]);
        fail(e);
      });
  }, [brandId, fail]);
  const loadSocial = useCallback(() => {
    brandSettingsApi
      .social(brandId)
      .then((r) => {
        setPages(r.data.pages);
        setProviders(r.data.providers);
      })
      .catch((e) => {
        setPages([]);
        fail(e);
      });
  }, [brandId, fail]);

  useEffect(() => {
    loadBrand();
  }, [loadBrand]);
  useEffect(() => {
    if (tab === 'members' && members === null) loadMembers();
    if (tab === 'accounts' && pages === null) loadSocial();
  }, [tab, members, pages, loadMembers, loadSocial]);
  useEffect(() => {
    const r = search.get('connect');
    if (!r || !CONNECT_RESULT.includes(r)) return;
    const detail = search.get('connect_error')?.trim();
    const translated = t(`brandSettings.accounts.result.${r}`);
    setNotice({
      kind: r === 'ok' ? 'success' : r === 'cancelled' ? 'info' : 'error',
      text: detail && r !== 'ok' ? `${translated} (${detail})` : translated,
    });
  }, [search, t]);

  const caps = new Set(brand?.access?.capabilities ?? []);
  const canManageWorkspace = caps.has('tenant.manage');
  useEffect(() => {
    let live = true;
    mediaApi
      .list(brandId, 'logos')
      .then((r) => {
        if (live)
          setLogoStorage({
            connected: r.data.workdrive.connected,
            orgName: r.data.workdrive.org_name,
            canConnect: canManageWorkspace,
          });
      })
      .catch(() => {
        if (live) setLogoStorage({ connected: false, orgName: null, canConnect: false });
      });
    return () => {
      live = false;
    };
  }, [brandId, canManageWorkspace]);

  const onTab = (next: BrandSettingsTab) => {
    setTab(next);
    setNotice(null);
    router.replace(`/app/brands/${brandId}/settings?tab=${next}`);
  };

  if (denied) return <PermissionDenied message={t('errors.permission')} />;
  if (error) return <ErrorState title={t('common.error')} body={error} />;
  if (!brand) return <DetailShimmer />;

  return (
    <BrandSettingsView
      t={t}
      tab={tab}
      onTab={onTab}
      brand={{
        id: brand.id,
        name: brand.name,
        logo_url: brand.logo_url ?? null,
        logo_asset_id: brand.logo_asset_id ?? null,
        timezone: brand.timezone ?? 'Asia/Dubai',
        archived: brand.status === 'ARCHIVED',
      }}
      timezones={timezones}
      canManage={caps.has('brand.create')}
      canManageMembers={caps.has('membership.manage')}
      canConnect={caps.has('brand.website.connect')}
      saving={saving}
      notice={notice}
      onSave={async (patch) => {
        setSaving(true);
        try {
          const { logoAssetId, logoUrl, ...rest } = patch;
          await brandSettingsApi.update(brandId, {
            ...rest,
            ...(logoAssetId
              ? logoAssetId !== brand.logo_asset_id
                ? { logo_asset_id: logoAssetId }
                : {}
              : logoUrl !== brand.logo_url
                ? { logoUrl }
                : {}),
            version: brand.version,
          });
          setNotice({ kind: 'success', text: t('brandSettings.saved') });
          loadBrand();
        } catch (e) {
          fail(e);
        } finally {
          setSaving(false);
        }
      }}
      logoStorage={logoStorage}
      onLogoFile={async (file) => {
        try {
          if (logoStorage?.connected) {
            const a = await mediaApi.upload(brandId, 'logos', file);
            return { url: a.view_url, assetId: a.id };
          }
          return { url: await readLogoFile(file), assetId: null };
        } catch (e) {
          if ((e as { status?: number }).status !== undefined) {
            fail(e);
            return null;
          }
          setNotice({
            kind: 'error',
            text: t(
              (e as Error).message === 'size'
                ? 'brandSettings.general.logoTooBig'
                : 'brandSettings.general.logoType',
            ),
          });
          return null;
        }
      }}
      onArchive={async () => {
        try {
          const r = await brandSettingsApi.archive(brandId, brand.version);
          setNotice({
            kind: 'success',
            text: t('brandSettings.danger.archived').replace(
              '{n}',
              String(r.data.unscheduled_posts ?? 0),
            ),
          });
          loadBrand();
        } catch (e) {
          fail(e);
        }
      }}
      onUnarchive={async () => {
        try {
          await brandSettingsApi.unarchive(brandId);
          setNotice({ kind: 'success', text: t('brandSettings.danger.unarchived') });
          loadBrand();
        } catch (e) {
          fail(e);
        }
      }}
      onDelete={async () => {
        try {
          await brandSettingsApi.remove(brandId);
          router.push('/app/brands');
        } catch (e) {
          fail(e);
        }
      }}
      members={members}
      candidates={candidates}
      onAddMember={async (userId, role) => {
        try {
          await brandSettingsApi.addMember(brandId, userId, role);
          loadMembers();
        } catch (e) {
          fail(e);
        }
      }}
      onRole={async (userId, role) => {
        try {
          await brandSettingsApi.setRole(brandId, userId, role);
          loadMembers();
        } catch (e) {
          fail(e);
        }
      }}
      onRemoveMember={async (userId) => {
        try {
          await brandSettingsApi.removeMember(brandId, userId);
          loadMembers();
        } catch (e) {
          fail(e);
        }
      }}
      pages={pages}
      providers={providers}
      connecting={connecting}
      onConnect={async (network) => {
        setConnecting(network);
        try {
          const r = await brandSettingsApi.connect(brandId, network);
          window.location.assign(r.data.authorize_url);
        } catch (e) {
          fail(e);
          setConnecting(null);
        }
      }}
      onDisconnect={async (page) => {
        try {
          await brandSettingsApi.disconnect(brandId, page.id);
          loadSocial();
        } catch (e) {
          fail(e);
        }
      }}
    />
  );
}
