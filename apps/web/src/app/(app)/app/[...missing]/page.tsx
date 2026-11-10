import { notFound } from 'next/navigation';

/** Catch-all so unknown /app/* routes render the standalone in-app 404. */
export default function MissingAppRoute() {
  notFound();
}
