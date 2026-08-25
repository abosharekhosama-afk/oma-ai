import Link from 'next/link';

export default function HomePage() {
  return (
    <main id="main" className="oma-container">
      <h1>OMA AI</h1>
      <p className="oma-muted">OMA AI by IMKAN</p>
      <p>
        <Link href="/login">Sign in</Link> · <Link href="/register">Create account</Link>
      </p>
    </main>
  );
}
