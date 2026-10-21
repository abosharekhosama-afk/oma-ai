import { redirect } from 'next/navigation';

/** Legacy OMA onboarding is replaced by Planable select-company create flow. */
export default function OnboardingPage() {
  redirect('/app/select-company');
}
