'use client';

import type { ReactNode } from 'react';
import { ListeningSidebarTree } from '../../../../components/listening/listening-sidebar-tree';
import { ListeningWorkspaceProvider } from '../../../../components/listening/listening-workspace-context';

export default function ListeningLayout({ children }: { children: ReactNode }) {
  return (
    <ListeningWorkspaceProvider>
      <div className="oma-plx-listening-shell" data-testid="listening-workspace-shell">
        <ListeningSidebarTree />
        <div className="oma-plx-listening-shell__main">{children}</div>
      </div>
    </ListeningWorkspaceProvider>
  );
}
