'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AtSignOutlined,
  CommentOutlined,
  DownOutlined,
  MinusCircleOutlined,
  ArrowRightOutlined,
  SmileOutlined,
} from '../ui/lucide-icons';
import { useT } from '../../lib/use-locale';
import { useListeningWorkspaceOptional } from './listening-workspace-context';

const SECTIONS = [
  { href: '/app/listening/brand', labelKey: 'listening.nav.brand' },
  { href: '/app/listening/topic', labelKey: 'listening.nav.topic' },
  { href: '/app/listening/competitors', labelKey: 'listening.nav.competitors' },
  { href: '/app/listening/alerts', labelKey: 'listening.nav.alerts' },
] as const;

export function ListeningSidebarTree() {
  const t = useT();
  const pathname = usePathname() || '';
  const ctx = useListeningWorkspaceOptional();
  const selected = ctx?.selectedHit;
  const actions = ctx?.treeActions ?? [];

  return (
    <aside className="oma-plx-listening-tree" data-testid="listening-sidebar-tree">
      <p className="oma-plx-listening-tree__eyebrow">{t('nav.listening')}</p>
      <ul className="oma-nav-tree" role="tree">
        {SECTIONS.map((s) => {
          const active = pathname.startsWith(s.href);
          return (
            <li key={s.href} className="oma-nav-tree__item" role="treeitem" aria-expanded={active}>
              <Link
                href={s.href}
                className="oma-nav-tree__row"
                data-active={active ? 'true' : 'false'}
              >
                <AtSignOutlined className="oma-nav-tree__ico" aria-hidden />
                <span className="oma-nav-tree__label">{t(s.labelKey)}</span>
                {active ? <DownOutlined className="oma-nav-tree__chev" aria-hidden /> : null}
              </Link>
              {active ? (
                <ul className="oma-nav-tree oma-nav-tree--child" role="group">
                  <li className="oma-nav-tree__item oma-nav-tree__item--leaf" role="treeitem">
                    <span className="oma-nav-tree__row oma-nav-tree__row--muted">
                      <CommentOutlined className="oma-nav-tree__ico" aria-hidden />
                      <span>{t('listening.mentions')}</span>
                    </span>
                  </li>
                  {selected ? (
                    <>
                      <li className="oma-nav-tree__item" role="treeitem" aria-expanded="true">
                        <span className="oma-nav-tree__row oma-nav-tree__row--branch">
                          <ArrowRightOutlined className="oma-nav-tree__chev oma-nav-tree__chev--open" />
                          <span className="oma-nav-tree__label oma-nav-tree__label--truncate">
                            {selected.authorName || selected.authorHandle || t('listening.mention')}
                          </span>
                        </span>
                        <ul className="oma-nav-tree oma-nav-tree--child" role="group">
                          {actions.length ? (
                            actions.map((a) => (
                              <li
                                key={a.id}
                                className="oma-nav-tree__item oma-nav-tree__item--action"
                                role="treeitem"
                              >
                                <button
                                  type="button"
                                  className="oma-nav-tree__row oma-nav-tree__row--action"
                                  onClick={a.onSelect}
                                >
                                  <span className="oma-nav-tree__stem" aria-hidden />
                                  <span>{t(a.labelKey)}</span>
                                </button>
                              </li>
                            ))
                          ) : (
                            <>
                              <li
                                className="oma-nav-tree__item oma-nav-tree__item--leaf"
                                role="treeitem"
                              >
                                <span className="oma-nav-tree__row oma-nav-tree__row--muted">
                                  <span className="oma-nav-tree__stem" aria-hidden />
                                  <CommentOutlined className="oma-nav-tree__ico" />
                                  <span>{t('listening.tree.reply_comment')}</span>
                                </span>
                              </li>
                              <li
                                className="oma-nav-tree__item oma-nav-tree__item--leaf"
                                role="treeitem"
                              >
                                <span className="oma-nav-tree__row oma-nav-tree__row--muted">
                                  <span className="oma-nav-tree__stem" aria-hidden />
                                  <SmileOutlined className="oma-nav-tree__ico" />
                                  <span>{t('listening.tree.sentiment')}</span>
                                </span>
                              </li>
                              <li
                                className="oma-nav-tree__item oma-nav-tree__item--leaf"
                                role="treeitem"
                              >
                                <span className="oma-nav-tree__row oma-nav-tree__row--muted">
                                  <span className="oma-nav-tree__stem" aria-hidden />
                                  <MinusCircleOutlined className="oma-nav-tree__ico" />
                                  <span>{t('listening.hideMention')}</span>
                                </span>
                              </li>
                            </>
                          )}
                        </ul>
                      </li>
                    </>
                  ) : null}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
