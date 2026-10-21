import { redirect } from 'next/navigation';

/** Skip OMA landing/login chrome — open product UI immediately. */
export default function HomePage() {
  redirect('/app');
}
