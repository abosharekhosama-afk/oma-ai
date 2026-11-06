'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CheckOutlined,
  ClockCircleOutlined,
  MoreOutlined,
  UserOutlined,
} from '../../../../components/ui/lucide-icons';
import type { InboxConversationDetail } from '../../../../lib/inbox-api';
import type { WorkspaceMember } from '../../../../lib/team-api';

export function InboxThreadMenu(props: {
  detail: InboxConversationDetail;
  t: (k: string) => string;
  members: WorkspaceMember[];
  onLater: () => void;
  onReopen: () => void;
  onMarkDone: () => void;
  onTogglePriority: () => void;
  onAssign: (userId: string | null) => void;
  onInternalNote: () => void;
}) {
  const {
    detail,
    t,
    members,
    onLater,
    onReopen,
    onMarkDone,
    onTogglePriority,
    onAssign,
    onInternalNote,
  } = props;
  const [open, setOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setAssignOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const isClosed = detail.status === 'CLOSED';
  const isLater = detail.status === 'PENDING';

  return (
    <div className="oma-plx-inbox-thread-menu" ref={rootRef}>
      <button
        type="button"
        className="oma-plx-inbox-icon-btn oma-plx-inbox-icon-btn--ghost"
        aria-label={t('inbox.menu.more') || 'More actions'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreOutlined />
      </button>
      {open ? (
        <div className="oma-plx-inbox-thread-menu__drop" role="menu">
          {!isClosed && !isLater ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onLater();
              }}
            >
              <ClockCircleOutlined /> {t('inbox.menu.later') || 'Move to later'}
            </button>
          ) : null}
          {isClosed || isLater ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onReopen();
              }}
            >
              {t('inbox.menu.reopen') || 'Reopen'}
            </button>
          ) : null}
          {!isClosed ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onMarkDone();
              }}
            >
              <CheckOutlined /> {t('inbox.markDone') || 'Mark as done'}
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onTogglePriority();
            }}
          >
            {detail.priority
              ? t('inbox.menu.removePriority') || 'Remove priority'
              : t('inbox.menu.priority') || 'Mark priority'}
          </button>
          <div className="oma-plx-inbox-thread-menu__sub">
            <button
              type="button"
              role="menuitem"
              className="oma-plx-inbox-thread-menu__sub-trigger"
              onClick={() => setAssignOpen((v) => !v)}
            >
              <UserOutlined /> {t('inbox.menu.assign') || 'Assign'}
            </button>
            {assignOpen ? (
              <div className="oma-plx-inbox-thread-menu__sub-panel" role="group">
                <button
                  type="button"
                  className={!detail.assignedToUserId ? 'is-active' : undefined}
                  onClick={() => {
                    setOpen(false);
                    setAssignOpen(false);
                    onAssign(null);
                  }}
                >
                  {t('inbox.assign.unassigned') || 'Unassigned'}
                </button>
                {members
                  .filter((m) => m.user?.id)
                  .map((m) => (
                    <button
                      key={m.user!.id}
                      type="button"
                      className={detail.assignedToUserId === m.user!.id ? 'is-active' : undefined}
                      onClick={() => {
                        setOpen(false);
                        setAssignOpen(false);
                        onAssign(m.user!.id);
                      }}
                    >
                      {m.user!.name || m.user!.email}
                    </button>
                  ))}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onInternalNote();
            }}
          >
            {t('inbox.menu.note') || 'Internal note'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
