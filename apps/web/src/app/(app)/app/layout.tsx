import type { Metadata } from 'next';

/** Authenticated product — never index tenant workspaces in search engines. */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default function AppProductLayout({ children }: { children: React.ReactNode }) {
  return children;
}
