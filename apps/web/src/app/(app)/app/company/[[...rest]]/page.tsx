import { redirect } from 'next/navigation';

/** The Company screen was merged into Team; keep old links working. */
export default function Page() {
  redirect('/app/team');
}
