import { AppShell } from '../../components/shell/app-shell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
