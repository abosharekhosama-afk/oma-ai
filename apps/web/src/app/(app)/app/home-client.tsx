'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { OmaLinkButton } from '../../../components/ui/oma-link-button';
import { api } from '../../../lib/api';
import { useLocale, useT } from '../../../lib/use-locale';
import { isPermissionDenied } from '../../../lib/brand-api';
import { EmptyState, DeniedState } from '../../../components/ui/empty-state';
import { useToast } from '../../../components/ui/toast';
import { getHome, type HomeAwaitingItem, type HomeData } from '../../../lib/home-api';
import { listNotifications } from '../../../lib/notifications-api';
import { listActivity, type ActivityItem } from '../../../lib/activity-api';
import { getPreferences, updatePreferences } from '../../../lib/account-api';
import { approveContent, contentApiError } from '../../../lib/content-api';
import { mapComments, shouldShowSetup, type HomeComment } from '../../../lib/home-view-model';
import { HomeView } from '../../../components/home/home-view';

type Me = { user: { name: string }; active_tenant_id: string | null };

const UNDO_MS = 5000;

export default function AppHomePage() {
  const t = useT();
  const locale = useLocale() === 'ar' ? 'ar' : 'en';
  const toast = useToast();
  const [me, setMe] = useState<Me | null>(null);
  const [home, setHome] = useState<HomeData | null>(null);
  const [comments, setComments] = useState<HomeComment[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [activityError, setActivityError] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [denied, setDenied] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [undo, setUndo] = useState<HomeAwaitingItem | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const next = await api<Me>('/api/v1/auth/me');
      setMe(next);
      if (!next.active_tenant_id) return;
      const [homeRes, notifRes, actRes, prefs] = await Promise.all([
        getHome().catch((err) => {
          if (isPermissionDenied(err)) throw err;
          return null;
        }),
        listNotifications().catch(() => ({ items: [], unread_count: 0 })),
        listActivity({ limit: 20 }).catch(() => null),
        getPreferences().catch(() => null),
      ]);
      setHome(homeRes);
      setError(!homeRes);
      setActivity(actRes?.items ?? []);
      setActivityError(!actRes);
      setComments(mapComments(notifRes.items, actRes?.items ?? []));
      setDismissed(Boolean(prefs?.homeSetupDismissed));
      setNow(new Date());
    } catch (err) {
      if (isPermissionDenied(err)) setDenied(true);
      else setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const commit = useCallback(
    async (item: HomeAwaitingItem) => {
      try {
        await approveContent(item.id);
        toast.push(t('home.v2.approvedToast'), 'success');
      } catch (err) {
        setHidden((h) => {
          const n = new Set(h);
          n.delete(item.id);
          return n;
        });
        toast.push(contentApiError(err, t('home.v2.approveFailed')), 'danger');
      }
    },
    [t, toast],
  );

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const onApprove = useCallback(
    (item: HomeAwaitingItem) => {
      // Commit any previous pending approval immediately, then stage this one with undo.
      if (undo) {
        flush();
        void commit(undo);
      }
      setHidden((h) => new Set(h).add(item.id));
      setUndo(item);
      timer.current = setTimeout(() => {
        timer.current = null;
        setUndo(null);
        void commit(item);
      }, UNDO_MS);
    },
    [undo, flush, commit],
  );

  const onUndo = () => {
    if (!undo) return;
    flush();
    setHidden((h) => {
      const n = new Set(h);
      n.delete(undo.id);
      return n;
    });
    setUndo(null);
  };

  // Never drop a staged approval on navigation: commit it on unmount.
  const undoRef = useRef(undo);
  undoRef.current = undo;
  useEffect(
    () => () => {
      if (timer.current && undoRef.current) {
        clearTimeout(timer.current);
        void approveContent(undoRef.current.id).catch(() => undefined);
      }
    },
    [],
  );

  const onDismissSetup = () => {
    setDismissed(true);
    updatePreferences({ homeSetupDismissed: true }).catch(() => {
      setDismissed(false);
      toast.push(t('home.v2.dismissFailed'), 'danger');
    });
  };

  if (!loading && me && !me.active_tenant_id) {
    return (
      <EmptyState
        title={t('home.noTenantTitle')}
        body={t('home.noTenantBody')}
        action={
          <OmaLinkButton href="/app/select-company" type="primary">
            {t('shell.emptyMembershipCta')}
          </OmaLinkButton>
        }
      />
    );
  }
  if (denied) return <DeniedState title={t('errors.permission')} />;

  return (
    <HomeView
      t={t}
      locale={locale}
      now={now}
      userName={me?.user.name ?? ''}
      loading={loading}
      error={error}
      onRetry={() => void load()}
      brands={home?.brand_summaries ?? []}
      awaiting={(home?.awaiting_me ?? []).filter((i) => !hidden.has(i.id))}
      canApprove={home?.can_approve !== false}
      onApprove={onApprove}
      comments={comments}
      week={home?.week?.items ?? []}
      weekTimezone={home?.week?.timezone}
      weekDays={home?.week?.days}
      setup={{
        steps: home?.checklist ?? [],
        visible: !loading && shouldShowSetup(home?.checklist, dismissed),
        onDismiss: onDismissSetup,
      }}
      activity={activity}
      activityError={activityError}
      feedback={
        undo ? (
          <div className="oma-home-undo" role="status" aria-live="polite" data-testid="home-approve-undo">
            <span>{t('home.v2.approvedPending')}</span>
            <button type="button" className="oma-home-link" onClick={onUndo}>
              {t('home.v2.undo')}
            </button>
          </div>
        ) : null
      }
    />
  );
}
