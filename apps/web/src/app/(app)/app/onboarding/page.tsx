import { redirect } from 'next/navigation';
/** Keep existing invitation URLs working while the acceptance flow lives outside the app shell. */
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string | string[] }>;
}) {
  const { invite } = await searchParams;
  const token = Array.isArray(invite) ? invite[0] : invite;
  if (token) redirect(`/invite?token=${encodeURIComponent(token)}`);
  redirect('/app/select-company');
}
