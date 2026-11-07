'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ListeningHit } from '../../lib/listening-api';

export type ListeningTreeAction = {
  id: string;
  labelKey: string;
  onSelect: () => void;
};

type ListeningWorkspaceValue = {
  selectedHit: ListeningHit | null;
  setSelectedHit: (hit: ListeningHit | null) => void;
  treeActions: ListeningTreeAction[];
  setTreeActions: (actions: ListeningTreeAction[]) => void;
};

const Ctx = createContext<ListeningWorkspaceValue | null>(null);

export function ListeningWorkspaceProvider({ children }: { children: ReactNode }) {
  const [selectedHit, setSelectedHit] = useState<ListeningHit | null>(null);
  const [treeActions, setTreeActionsState] = useState<ListeningTreeAction[]>([]);
  const setTreeActions = useCallback((actions: ListeningTreeAction[]) => {
    setTreeActionsState(actions);
  }, []);
  const value = useMemo(
    () => ({ selectedHit, setSelectedHit, treeActions, setTreeActions }),
    [selectedHit, treeActions, setTreeActions],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useListeningWorkspace() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('useListeningWorkspace requires ListeningWorkspaceProvider');
  }
  return ctx;
}

export function useListeningWorkspaceOptional() {
  return useContext(Ctx);
}
