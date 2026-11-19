import type { Metadata } from 'next';
import { publicSiteIndexable } from '../../lib/public-site';

export const metadata: Metadata = {
  robots: publicSiteIndexable() ? { index: true, follow: true } : { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
