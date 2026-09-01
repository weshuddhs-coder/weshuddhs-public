import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// Tracking pages carry customer order references — keep them out of search
// indexes. Styling is handled by the app's compiled Tailwind build.
export const metadata: Metadata = {
  title: 'Track your WeShuddhs order',
  description: 'Live delivery status for your WeShuddhs order.',
  robots: { index: false, follow: false },
};

export default function TrackLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
