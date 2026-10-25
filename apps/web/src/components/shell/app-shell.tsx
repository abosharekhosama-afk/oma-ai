import { MembershipRouteGate } from './membership-route-gate';
import { ShellChrome } from './shell-chrome';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ShellChrome>
      <MembershipRouteGate>{children}</MembershipRouteGate>
    </ShellChrome>
  );
}
