import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import OnboardingClient from './onboarding-client';

/**
 * Legacy OMA onboarding is replaced by the Planable select-company create flow.
 * It stays reachable for invitation links (`/app/onboarding?invite=<token>`) sent by email.
 */
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string | string[] }>;
}) {
  const { invite } = await searchParams;
  if (!invite) redirect('/app/select-company');
  return (
    <Suspense fallback={null}>
      <OnboardingClient />
    </Suspense>
  );
}
