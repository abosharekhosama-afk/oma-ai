'use client';

import { CheckOutlined, SearchOutlined, UserDeleteOutlined } from '@ant-design/icons';
import { Input, Popover } from '@oma/ui/controls';
import { useMemo, useState } from 'react';
import type { WorkspaceMember } from '../../lib/team-api';
import { useT } from '../../lib/use-locale';

export type AssigneeChoice = { userId: string | null; name: string };

function memberName(m: WorkspaceMember): string {
  return (m.user?.name && m.user.name.trim()) || m.user?.email || m.invited_email || '';
}

function memberRole(m: WorkspaceMember): string {
  return (m.display_role || m.role || m.membership_kind || '').toString();
}

function initials(value: string): string {
  const parts = value
    .trim()
    .split(/[\s@._-]+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

/**
 * Planable-style assignee picker: a popover card with search, member rows
 * (avatar, name, role), the current assignee highlighted and an Unassign row.
 * Only members with a real user account are assignable.
 */
export function AssigneePicker({
  members,
  value,
  valueName,
  disabled,
  onChange,
  testId = 'assignee-picker',
}: {
  members: WorkspaceMember[];
  value: string | null | undefined;
  valueName?: string | null;
  disabled?: boolean;
  onChange: (choice: AssigneeChoice) => void;
  testId?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const assignable = useMemo(
    () => members.filter((m) => m.user?.id && (!m.status || m.status.toUpperCase() === 'ACTIVE')),
    [members],
  );
  const current = assignable.find((m) => m.user?.id === value) ?? null;
  const currentName = current ? memberName(current) : value ? valueName || '' : '';

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return assignable;
    return assignable.filter((m) =>
      [memberName(m), m.user?.email ?? '', memberRole(m)].some((s) =>
        s.toLowerCase().includes(needle),
      ),
    );
  }, [assignable, q]);

  function pick(choice: AssigneeChoice) {
    setOpen(false);
    setQ('');
    if (choice.userId === (value ?? null)) return;
    onChange(choice);
  }

  const card = (
    <div className="oma-assignee-card" data-testid={`${testId}-card`}>
      <div className="oma-assignee-card__search">
        <Input
          autoFocus
          size="small"
          prefix={<SearchOutlined />}
          value={q}
          placeholder={t('assignee.search')}
          aria-label={t('assignee.search')}
          data-testid={`${testId}-search`}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <ul className="oma-assignee-card__list" role="listbox" aria-label={t('assignee.title')}>
        {value ? (
          <li>
            <button
              type="button"
              role="option"
              aria-selected={false}
              className="oma-assignee-card__row oma-assignee-card__row--unassign"
              data-testid={`${testId}-unassign`}
              onClick={() => pick({ userId: null, name: 'Unassigned' })}
            >
              <span className="oma-assignee-card__avatar oma-assignee-card__avatar--empty">
                <UserDeleteOutlined />
              </span>
              <span className="oma-assignee-card__name">{t('assignee.unassign')}</span>
            </button>
          </li>
        ) : null}
        {filtered.map((m) => {
          const id = m.user!.id;
          const name = memberName(m);
          const active = id === value;
          return (
            <li key={m.id}>
              <button
                type="button"
                role="option"
                aria-selected={active}
                className={`oma-assignee-card__row${active ? ' is-active' : ''}`}
                data-testid={`${testId}-option-${id}`}
                onClick={() => pick({ userId: id, name })}
              >
                <span className="oma-assignee-card__avatar" aria-hidden>
                  {initials(name)}
                </span>
                <span className="oma-assignee-card__text">
                  <span className="oma-assignee-card__name">{name}</span>
                  {memberRole(m) ? (
                    <span className="oma-assignee-card__role">{memberRole(m)}</span>
                  ) : null}
                </span>
                {active ? <CheckOutlined className="oma-assignee-card__check" /> : null}
              </button>
            </li>
          );
        })}
        {filtered.length === 0 ? (
          <li className="oma-assignee-card__empty">{t('assignee.noMatches')}</li>
        ) : null}
      </ul>
    </div>
  );

  return (
    <Popover
      open={open && !disabled}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setQ('');
      }}
      trigger="click"
      placement="bottomLeft"
      arrow={false}
      content={card}
      styles={{ container: { padding: 0 } }}
      rootClassName="oma-assignee-popover"
      destroyOnHidden
    >
      <button
        type="button"
        className="oma-assignee-trigger"
        data-testid={testId}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
      >
        {currentName ? (
          <>
            <span className="oma-assignee-card__avatar" aria-hidden>
              {initials(currentName)}
            </span>
            <span className="oma-assignee-trigger__name">{currentName}</span>
          </>
        ) : (
          <>
            <span
              className="oma-assignee-card__avatar oma-assignee-card__avatar--empty"
              aria-hidden
            >
              +
            </span>
            <span className="oma-assignee-trigger__name oma-muted">{t('assignee.unassigned')}</span>
          </>
        )}
      </button>
    </Popover>
  );
}
