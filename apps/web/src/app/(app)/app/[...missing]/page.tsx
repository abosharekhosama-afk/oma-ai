import { notFound } from 'next/navigation';

/** Catch-all so unknown /app/* routes render the in-shell 404 instead of the bare root page. */
export default function MissingAppRoute() {
  notFound();
}
