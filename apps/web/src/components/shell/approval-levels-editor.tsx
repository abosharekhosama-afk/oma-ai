'use client';

import { useEffect, useState } from 'react';
import {
  getWorkspaceApprovalLevels,
  saveWorkspaceApprovalLevels,
  type ApiApprovalLevel,
  type ApprovalLevelInput,
} from '../../lib/content-api';
import { contentApiError } from '../../lib/content-api';
import type { WorkspaceMember } from '../../lib/team-api';
import { useT } from '../../lib/use-locale';

const MAX_LEVELS = 5;

type DraftLevel = { nameEn: string; nameAr: string; min: number; approvers: string[] };

function toDraft(levels: ApiApprovalLevel[]): DraftLevel[] {
  return levels.map((l) => ({
    nameEn: l.name.en,
    nameAr: l.name.ar,
    min: l.min_approvals,
    approvers: l.approver_user_ids,
  }));
}

/**
 * Planable-style multi-level approval editor (DEC-026): ordered levels, a name
 * per level (EN/AR), required approvals and the assigned approvers.
 * No levels = the approver counter above applies.
 */
export function ApprovalLevelsEditor({
  members,
  onError,
}: {
  members: WorkspaceMember[];
  onError: (msg: string) => void;
}) {
  const t = useT();
  const [levels, setLevels] = useState<DraftLevel[]>([]);
  const [saved, setSaved] = useState<string>('[]');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getWorkspaceApprovalLevels()
      .then((l) => {
        const d = toDraft(l);
        setLevels(d);
        setSaved(JSON.stringify(d));
      })
      .catch(() => undefined);
  }, []);

  const approvers = members.filter((m) => m.user?.id && m.status === 'ACTIVE');
  const dirty = JSON.stringify(levels) !== saved;
  const update = (i: number, patch: Partial<DraftLevel>) =>
    setLevels((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const move = (i: number, dir: -1 | 1) =>
    setLevels((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  async function save() {
    setBusy(true);
    try {
      const body: ApprovalLevelInput[] = levels.map((l) => ({
        name: { en: l.nameEn.trim(), ar: l.nameAr.trim() || l.nameEn.trim() },
        min_approvals: l.min,
        approver_user_ids: l.approvers,
      }));
      const d = toDraft(await saveWorkspaceApprovalLevels(body));
      setLevels(d);
      setSaved(JSON.stringify(d));
    } catch (err) {
      onError(contentApiError(err, t('demo.unavailable')));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="oma-ws-levels" data-testid="ws-approval-levels">
      <h3 className="oma-ws-appr-sub">{t('approvalLevels.title')}</h3>
      <p className="oma-muted">{t('approvalLevels.help')}</p>
      <ol className="oma-ws-levels__list">
        {levels.map((l, i) => (
          <li key={i} className="oma-ws-levels__item" data-testid={`ws-approval-level-${i + 1}`}>
            <div className="oma-ws-levels__head">
              <span className="oma-ws-levels__index">{i + 1}</span>
              <input
                className="oma-ws-levels__input"
                value={l.nameEn}
                maxLength={60}
                placeholder={t('approvalLevels.name_en')}
                aria-label={t('approvalLevels.name_en')}
                onChange={(e) => update(i, { nameEn: e.target.value })}
              />
              <input
                className="oma-ws-levels__input"
                dir="rtl"
                value={l.nameAr}
                maxLength={60}
                placeholder={t('approvalLevels.name_ar')}
                aria-label={t('approvalLevels.name_ar')}
                onChange={(e) => update(i, { nameAr: e.target.value })}
              />
              <label className="oma-ws-levels__min">
                {t('approvalLevels.min')}
                <select
                  className="oma-ws-appr-select"
                  value={String(l.min)}
                  onChange={(e) => update(i, { min: Number(e.target.value) })}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={String(n)}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="oma-ws-levels__icon"
                aria-label={t('approvalLevels.move_up')}
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="oma-ws-levels__icon"
                aria-label={t('approvalLevels.move_down')}
                disabled={i === levels.length - 1}
                onClick={() => move(i, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className="oma-ws-levels__icon"
                aria-label={t('approvalLevels.remove')}
                onClick={() => setLevels((prev) => prev.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </div>
            <div className="oma-ws-levels__approvers">
              <span className="oma-muted">
                {l.approvers.length ? t('approvalLevels.approvers') : t('approvalLevels.anyone')}
              </span>
              {approvers.map((m) => {
                const id = m.user!.id;
                const on = l.approvers.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    className={`oma-ws-levels__chip${on ? ' is-on' : ''}`}
                    aria-pressed={on}
                    onClick={() =>
                      update(i, {
                        approvers: on ? l.approvers.filter((x) => x !== id) : [...l.approvers, id],
                      })
                    }
                  >
                    {m.user?.name || m.user?.email}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ol>
      <div className="oma-ws-levels__actions">
        <button
          type="button"
          className="oma-ws-appr-more"
          disabled={levels.length >= MAX_LEVELS}
          data-testid="ws-approval-level-add"
          onClick={() =>
            setLevels((prev) => [...prev, { nameEn: '', nameAr: '', min: 1, approvers: [] }])
          }
        >
          {t('approvalLevels.add')}
        </button>
        <button
          type="button"
          className="oma-ws-appr-more"
          disabled={!dirty || busy || levels.some((l) => !l.nameEn.trim())}
          data-testid="ws-approval-levels-save"
          onClick={() => void save()}
        >
          {t('approvalLevels.save')}
        </button>
      </div>
    </div>
  );
}
