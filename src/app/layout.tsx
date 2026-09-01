import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Track your WeShuddhs order',
  description: 'WeShuddhs — track your parcel and view your invoice.',
};

// Deliberately bare: this host serves ONLY customer-facing pages, so there is
// no app shell, no auth, no providers. Each page owns its full-page styling.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
