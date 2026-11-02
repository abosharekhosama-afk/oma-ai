import { redirect } from 'next/navigation';
import { isSettingsSection } from '../../../../components/settings/settings-sections';

/** Settings now live in a card opened from the account menu; keep old links working. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const { section } = await searchParams;
  if (section === 'notifications') redirect('/app/team?tab=notifications');
  const target =
    !section || section === 'general' || section === 'workspace'
      ? 'workspace'
      : isSettingsSection(section)
        ? section
        : 'workspace';
  redirect(`/app?settings=${target}`);
}
