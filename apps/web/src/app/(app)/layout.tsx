'use client';
import { usePathname } from 'next/navigation';
import { AppShell } from '../../components/shell/app-shell';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith('/app/select-company')) return <>{children}</>;
  return <AppShell>{children}</AppShell>;
}
