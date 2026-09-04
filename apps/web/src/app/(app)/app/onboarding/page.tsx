import { Suspense } from 'react';
import OnboardingClient from './onboarding-client';

export default function OnboardingPage() {
  return (
    <Suspense fallback={<p role="status">Loading…</p>}>
      <OnboardingClient />
    </Suspense>
  );
}
