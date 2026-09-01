import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Script from 'next/script';

/**
 * Metadata override for the public /track/[awb] tracking pages — otherwise
 * they inherit the root layout's title and get indexed by default.
 */
export const metadata: Metadata = {
  title: 'Track your WeShuddhs order',
  description: 'Live delivery status for your WeShuddhs order.',
  robots: { index: false, follow: false },
};

/**
 * This standalone customer host has NO Tailwind build step (no tailwindcss /
 * postcss / config in package.json), yet the ported CRM tracking markup is
 * expressed entirely in Tailwind utility classes. We load the Tailwind Play
 * CDN so those classes are compiled at runtime and the page renders identically
 * to the CRM version. If a compiled Tailwind pipeline is added later, drop this
 * script. `afterInteractive` is used because `beforeInteractive` is only valid
 * in the root app/layout.tsx (which this app keeps untouched); the CDN installs
 * a MutationObserver, so the client-rendered tracking states stay styled.
 */
export default function TrackLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Script src="https://cdn.tailwindcss.com" strategy="afterInteractive" />
      {children}
    </>
  );
}
