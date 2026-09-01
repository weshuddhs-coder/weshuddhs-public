'use client';

import { useEffect, useState, Suspense, type FormEvent } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { friendlyName } from '@/lib/track/friendly-name';

/* ────────────────────────────────────────────────────────────────────────────
 * Branded public order tracking — /track/[awb]
 *
 * Standalone, customer-facing page (WeShuddhs / Dr Nishant Gupta). Renders a
 * clean milestone stepper, EDD, courier, and a "WhatsApp us" help CTA. It hits
 * the NO-AUTH GET /api/shipping/track-public on the CRM and shows ONLY
 * customer-safe data.
 *
 * PORTED into the standalone public app: this host has NO CRM code and NO API
 * routes of its own, so every fetch targets the CRM over an ABSOLUTE https URL
 * (`${CRM_API}/...`). Because this is a client component, a non-public env var
 * would not be readable at runtime, so the CRM base is a hardcoded constant.
 * ──────────────────────────────────────────────────────────────────────────── */

// The CRM's public API base. Hardcoded (not read from process.env) because this
// is a client component: only NEXT_PUBLIC_* env is inlined into the browser
// bundle, so a bare process.env value would be undefined at runtime.
const CRM_API = 'https://crm.weshuddhs.in';

const FALLBACK_SUPPORT_WA = '918690896808'; // WeShuddhs support WhatsApp

interface Milestone {
  key: string;
  label: string;
  reached: boolean;
  current: boolean;
  at: string | null;
}

interface PublicBrand {
  brandName: string;
  tagline: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  supportWhatsapp: string;
  website: string;
  upsellEnabled: boolean;
  upsellHeading: string;
  footerMessage: string;
}

interface UpsellItem {
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  url: string | null;
}

interface TrackData {
  found: boolean;
  awb: string | null;
  courierName: string | null;
  status: string;
  statusRaw: string | null;
  maskedPhone: string | null;
  customerName: string | null;
  estimatedDelivery: string | null;
  deliveredAt: string | null;
  destinationCity: string | null;
  destinationState: string | null;
  milestones: Milestone[];
  lastScan: { label: string; location: string | null; at: string | null } | null;
  /** Every courier scan, newest first. */
  journey?: Array<{ at: string | null; label: string; location: string | null; status: string | null }>;
  brand?: PublicBrand;
  upsell?: UpsellItem[];
}

// Loose AWB-shape heuristic for the landing-page lookup form: DTDC AWBs are
// "7D" + digits; other couriers issue dense 10-15 char alphanumeric strings.
// Anything else (a Shopify order number like "77" or "#1234") is treated as
// an order number and requires phone verification.
const AWB_SHAPE_DTDC = /^7D\d+$/i;
const AWB_SHAPE_GENERIC = /^[A-Z0-9]{10,15}$/i;
function looksLikeAwb(value: string): boolean {
  const t = value.trim();
  return AWB_SHAPE_DTDC.test(t) || AWB_SHAPE_GENERIC.test(t);
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return dt.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function fmtDateOnly(d: string | null | undefined): string {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return dt.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

// Icons rendered inline (no icon lib) — one per milestone rung.
function MilestoneIcon({ k, active }: { k: string; active: boolean }) {
  const cls = `w-4 h-4 ${active ? 'text-white' : 'text-slate-500'}`;
  switch (k) {
    case 'confirmed':
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      );
    case 'picked':
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      );
    case 'in_transit':
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1" />
        </svg>
      );
    case 'out_for_delivery':
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case 'delivered':
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      );
    default:
      return null;
  }
}

// Shared AWB-or-order lookup form — powers the /track/lookup landing page
// AND is re-rendered inline inside the "not found" card so a typo is
// retryable in place, without leaving the branded page.
function LookupForm({ primary, autoFocus }: { primary: string; autoFocus?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [phone, setPhone] = useState('');
  const [touched, setTouched] = useState(false);

  const trimmed = value.trim();
  const isAwb = trimmed.length > 0 && looksLikeAwb(trimmed);
  const needsPhone = trimmed.length > 0 && !isAwb;
  const phoneValid = phone.replace(/\D/g, '').slice(-10).length === 10;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!trimmed) return;
    if (isAwb) {
      router.push(`/track/${encodeURIComponent(trimmed)}`);
      return;
    }
    if (!phoneValid) return;
    router.push(`/track/lookup?order=${encodeURIComponent(trimmed)}&phone=${encodeURIComponent(phone.trim())}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-left">
      <div>
        <label htmlFor="lookup-value" className="block text-xs font-medium text-slate-500 mb-1.5">
          AWB or order number
        </label>
        <input
          id="lookup-value"
          type="text"
          autoFocus={autoFocus}
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. 7D12345678 or #1234"
          className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-base text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300"
        />
      </div>

      {needsPhone && (
        <div>
          <label htmlFor="lookup-phone" className="block text-xs font-medium text-slate-500 mb-1.5">
            Phone number on the order
          </label>
          <input
            id="lookup-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="10-digit mobile number"
            className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-base text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300"
          />
          {touched && !phoneValid && (
            <p className="text-xs text-red-600 mt-1.5">Enter the 10-digit phone number on the order.</p>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={!trimmed || (needsPhone && !phoneValid)}
        className="w-full inline-flex items-center justify-center gap-2 px-4 min-h-[44px] rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ backgroundColor: primary }}
      >
        Track order
      </button>
    </form>
  );
}

// Branded landing card for /track/lookup with no ?order= — previously a
// dead-end: the page fetched with an empty query, got `missing_query`, and
// permanently rendered the "not found" error card with no way to search.
function LookupLandingCard({ primary }: { primary: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="text-center mb-6">
        <div
          className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-3"
          style={{ backgroundColor: `${primary}14` }}
        >
          <svg className="w-6 h-6" style={{ color: primary }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <h1 className="text-base font-semibold text-slate-900">Track your order</h1>
        <p className="text-sm text-slate-500 mt-1">
          Enter your AWB (tracking) number, or your order number with the phone number used to order.
        </p>
      </div>
      <LookupForm primary={primary} autoFocus />
    </div>
  );
}

function TrackPageInner() {
  const params = useParams();
  const search = useSearchParams();
  const rawAwb = params?.awb;
  const awb = (Array.isArray(rawAwb) ? rawAwb[0] : rawAwb) || '';
  // Allow the order+phone path via query (?order=&phone=) when the URL segment
  // is a placeholder like "lookup".
  const orderRef = search.get('order') || '';
  const phone = search.get('phone') || '';
  // The bare tracking-domain landing page: /track/lookup with no ?order= yet.
  // There is nothing to look up — show the branded search card instead of
  // firing a fetch that can only ever 400.
  const showLandingLookup = awb.toLowerCase() === 'lookup' && !orderRef;

  const [data, setData] = useState<TrackData | null>(null);
  const [showJourney, setShowJourney] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Label-QR gift: ?offer=50 (legacy links may carry 100). The claim endpoint
  // mints/returns the order-derived Shopify code.
  const offerParam = ['50', '100'].includes(search.get('offer') || '');
  const [claimCode, setClaimCode] = useState<string | null>(null);
  const [claimTerms, setClaimTerms] = useState<string | null>(null);
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimCopied, setClaimCopied] = useState(false);
  const claimOffer = async () => {
    const claimAwb = data?.awb || awb;
    if (!claimAwb || claimBusy) return;
    setClaimBusy(true);
    setClaimError(null);
    try {
      const r = await fetch(`${CRM_API}/api/public/claim-offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ awb: claimAwb }),
      });
      const d = await r.json();
      if (!r.ok || !d.code) throw new Error(d.error || 'claim_failed');
      setClaimCode(d.code as string);
      setClaimTerms((d.terms as string) || null);
    } catch {
      setClaimError('Could not fetch your code right now — WhatsApp us and we’ll send it.');
    } finally {
      setClaimBusy(false);
    }
  };

  useEffect(() => {
    if (showLandingLookup) {
      setLoading(false);
      setError(null);
      setData(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    const qs = new URLSearchParams();
    if (awb && awb.toLowerCase() !== 'lookup') {
      qs.set('awb', awb);
    } else if (orderRef) {
      qs.set('order', orderRef);
      if (phone) qs.set('phone', phone);
    }

    fetch(`${CRM_API}/api/shipping/track-public?${qs.toString()}`)
      .then((r) => r.json())
      .then((d: TrackData) => {
        if (!active) return;
        setData(d);
      })
      .catch(() => {
        if (active) setError('Something went wrong. Please try again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [awb, orderRef, phone, showLandingLookup]);

  const brand = data?.brand;
  const brandName = brand?.brandName || 'WeShuddhs';
  const supportWa = brand?.supportWhatsapp || FALLBACK_SUPPORT_WA;
  const primary = brand?.primaryColor || '#1a3c2a';
  const accent = brand?.accentColor || '#8ecc06';
  // brand.logoUrl arrives as the CRM-relative "/api/brand/logo"; resolve it to
  // an absolute CRM URL so the <img> loads from the CRM, not this public host.
  const logoSrc = brand?.logoUrl
    ? brand.logoUrl.startsWith('http')
      ? brand.logoUrl
      : `${CRM_API}${brand.logoUrl}`
    : null;

  const waHelp = (() => {
    const ref = data?.awb || awb || orderRef;
    const text = encodeURIComponent(
      `Hi ${brandName} team, I need help with my order tracking${ref ? ` (${ref})` : ''}.`
    );
    return `https://wa.me/${supportWa}?text=${text}`;
  })();

  const isDelivered = (data?.statusRaw || '').toLowerCase() === 'delivered';
  const isRto = (data?.statusRaw || '').toLowerCase().startsWith('rto');
  const isCancelled = (data?.statusRaw || '').toLowerCase() === 'cancelled';
  const showUpsell = !!(brand?.upsellEnabled && data?.upsell && data.upsell.length > 0);
  const greetingName = friendlyName(data?.customerName);
  // Hero chips sit on white normally and on the inverted primary when delivered.
  const chipTone = isDelivered ? 'bg-white/15' : 'bg-slate-100';

  // min-h-dvh, not h-screen: h-screen pins the page to exactly 100vh and moves
  // the real scroll onto an inner element, which fights mobile Safari/Chrome's
  // collapsing URL bar. dvh tracks the live viewport and lets the page scroll.
  return (
    <div className="min-h-dvh bg-gradient-to-b from-emerald-50/60 via-white to-white">
      {/* Brand header */}
      <header className="border-b border-emerald-100/80 bg-white/80 backdrop-blur">
        <div className="max-w-xl mx-auto px-5 py-4 flex items-center gap-3">
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            // Decorative: the wordmark beside it already names the brand, so a
            // real alt made screen readers announce "WeShuddhs WeShuddhs".
            <img
              src={logoSrc}
              alt=""
              aria-hidden="true"
              className="w-9 h-9 rounded-xl object-contain bg-white shadow-sm border border-slate-100"
            />
          ) : (
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm"
              style={{ backgroundColor: primary }}
            >
              {brandName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="leading-tight min-w-0">
            <div className="text-base font-semibold text-slate-900 tracking-tight">{brandName}</div>
            {/* The tagline is Devanagari ("पक्के वाला देसी"). Inter has no
                Devanagari coverage so it falls through to a system Indic face
                with taller metrics — 11px/leading-tight clipped the matras. */}
            <div className="text-xs leading-5 font-medium" lang="hi" style={{ color: primary }}>
              {brand?.tagline || 'Dr. Nishant Gupta Ayurveda'}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-5 py-6 space-y-6">
        {/* Landing lookup — /track/lookup with no ?order= yet. The bare
            tracking-domain landing page: nothing to fetch, so show the
            branded search card instead of an inevitable 400. */}
        {showLandingLookup && <LookupLandingCard primary={primary} />}

        {/* Loading */}
        {!showLandingLookup && loading && (
          <div className="space-y-4">
            <div className="h-24 rounded-2xl bg-slate-100 motion-safe:animate-pulse" />
            <div className="h-72 rounded-2xl bg-slate-100 motion-safe:animate-pulse" />
          </div>
        )}

        {/* Error */}
        {!showLandingLookup && !loading && error && (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-center">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Not found */}
        {!showLandingLookup && !loading && !error && data && !data.found && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 text-center shadow-sm">
            <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-slate-900">We couldn&apos;t find that order</h2>
            <p className="text-sm text-slate-500 mt-1">
              Please double-check your tracking number. If you used an order number, make sure the
              phone number matches the one on your order.
            </p>
            {/* Same lookup form as the landing page — a typo is retryable in place. */}
            <div className="mt-5">
              <LookupForm primary={primary} />
            </div>
            <div className="mt-5 pt-5 border-t border-slate-100">
              <a
                href={waHelp}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 min-h-[44px] rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ backgroundColor: primary }}
              >
                <WaIcon /> Chat with us on WhatsApp
              </a>
            </div>
          </div>
        )}

        {/* Found */}
        {!showLandingLookup && !loading && !error && data && data.found && (
          <>
            {/* Status hero */}
            <section
              className={`rounded-2xl p-5 sm:p-6 shadow-sm border ${
                isDelivered
                  ? 'text-white'
                  : isRto
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-white border-slate-200'
              }`}
              style={isDelivered ? { backgroundColor: primary, borderColor: primary } : undefined}
            >
              <div className={`text-[13px] font-medium ${isDelivered ? 'text-emerald-100' : 'text-slate-500'}`}>
                {greetingName ? `Hi ${greetingName},` : 'Order status'}
              </div>
              <h1 className={`text-2xl font-semibold tracking-tight mt-1 ${isDelivered ? 'text-white' : 'text-slate-900'}`}>
                {data.status}
              </h1>

              {/* EDD / delivered line */}
              {isCancelled ? (
                <p className="text-sm mt-1.5 text-slate-500">
                  This shipment was cancelled. If a replacement was sent, you&apos;ll receive a new
                  tracking link.
                </p>
              ) : isDelivered && data.deliveredAt ? (
                <p className="text-sm text-emerald-50 mt-1.5">
                  Delivered on {fmtDate(data.deliveredAt)}
                </p>
              ) : data.estimatedDelivery ? (
                // The delivered hero inverts to white-on-primary, so this line
                // and its emphasised date must invert too — slate-500 on the
                // dark green was effectively invisible.
                <p className={`text-sm mt-1.5 ${isDelivered ? 'text-emerald-50' : isRto ? 'text-amber-800' : 'text-slate-500'}`}>
                  Estimated delivery{' '}
                  <span className={`font-medium ${isDelivered ? 'text-white' : 'text-slate-900'}`}>
                    {fmtDateOnly(data.estimatedDelivery)}
                  </span>
                </p>
              ) : (
                <p className={`text-sm mt-1.5 ${isDelivered ? 'text-emerald-50' : 'text-slate-500'}`}>
                  We&apos;ll keep this page updated as your order moves.
                </p>
              )}

              {/* Meta chips — one family, so all three are built identically.
                  The AWB label is a real muted colour rather than opacity-70,
                  which was compounding against the chip background. */}
              <div className={`flex flex-wrap gap-2 mt-4 text-xs ${isDelivered ? 'text-emerald-50' : 'text-slate-700'}`}>
                {data.awb && (
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ${chipTone}`}>
                    <span className={isDelivered ? 'text-emerald-200' : 'text-slate-500'}>AWB</span>
                    <span className="font-mono font-medium">{data.awb}</span>
                  </span>
                )}
                {data.courierName && (
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ${chipTone}`}>
                    {data.courierName}
                  </span>
                )}
                {(data.destinationCity || data.destinationState) && (
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ${chipTone}`}>
                    {[data.destinationCity, data.destinationState].filter(Boolean).join(', ')}
                  </span>
                )}
              </div>
            </section>

            {/* ₹100 label-gift claim card (QR on the slip appends ?offer=100) */}
            {offerParam && !isCancelled && !isRto && (
              <section
                className="rounded-2xl border-2 p-5 shadow-sm bg-white"
                style={{ borderColor: accent }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900">
                      🎁 Your ₹50 is real — claim it
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      A one-time code for your next order, tied to this parcel.
                    </p>
                  </div>
                </div>
                {claimCode ? (
                  <div className="mt-3">
                    {/* wrap + break-all: a long code plus the Copy button
                        overflowed the card at 360px */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="font-mono text-lg font-extrabold tracking-wide px-3 py-1.5 rounded-lg border border-dashed min-w-0 break-all"
                        style={{ borderColor: primary, color: primary }}
                      >
                        {claimCode}
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(claimCode);
                            setClaimCopied(true);
                            setTimeout(() => setClaimCopied(false), 1500);
                          } catch { /* clipboard unavailable */ }
                        }}
                        className="text-xs font-bold px-3 py-2 rounded-lg text-white"
                        style={{ backgroundColor: primary }}
                      >
                        {claimCopied ? 'Copied ✓' : 'Copy'}
                      </button>
                    </div>
                    {claimTerms && <p className="text-[11px] text-slate-500 mt-2">{claimTerms}</p>}
                    <a
                      href={`https://${(brand?.website || 'weshuddhs.in').replace(/^https?:\/\//, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-2 text-xs font-bold"
                      style={{ color: primary }}
                    >
                      Use it now →
                    </a>
                  </div>
                ) : (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={claimOffer}
                      disabled={claimBusy}
                      className="px-4 min-h-[44px] rounded-xl text-sm font-extrabold text-white disabled:opacity-60"
                      style={{ backgroundColor: primary }}
                    >
                      {claimBusy ? 'Fetching your code…' : 'Reveal my ₹50 code'}
                    </button>
                    {claimError && <p className="text-xs text-amber-700 mt-2">{claimError}</p>}
                  </div>
                )}
              </section>
            )}

            {/* Milestone stepper — meaningless for a cancelled or returning
                consignment (RTO would otherwise still show forward-delivery
                rungs like "Out for Delivery" as if progressing toward the
                customer). */}
            {!isCancelled && !isRto && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900 tracking-tight mb-5">Journey</h2>
              <ol className="relative">
                {data.milestones.map((m, i) => {
                  const last = i === data.milestones.length - 1;
                  const active = m.reached;
                  // Three distinct tiers, not two. 'current' is also 'reached',
                  // so without this the step the customer most wants to find
                  // looked identical to the ones already behind it.
                  const done = active && !m.current;
                  return (
                    <li
                      key={m.key}
                      aria-current={m.current ? 'step' : undefined}
                      className="relative flex gap-4 pb-6 last:pb-0"
                    >
                      {/* connector line — starts below the current step's ring
                          so the 4px halo isn't clipped by it */}
                      {!last && (
                        <span
                          aria-hidden
                          className={`absolute left-[15px] ${m.current ? 'top-10' : 'top-8'} bottom-0 w-0.5`}
                          style={{
                            backgroundColor: data.milestones[i + 1]?.reached ? primary : '#e2e8f0',
                          }}
                        />
                      )}
                      {/* node */}
                      <span
                        className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                          active ? '' : 'bg-white border-slate-200'
                        } ${m.current ? 'ring-4' : ''}`}
                        style={
                          active
                            ? {
                                backgroundColor: primary,
                                borderColor: primary,
                                ...(m.current ? { boxShadow: `0 0 0 4px ${primary}1f` } : {}),
                              }
                            : undefined
                        }
                      >
                        <MilestoneIcon k={m.key} active={active} />
                      </span>
                      {/* label — carries the state in weight and colour, so it
                          reads without relying on the node colour alone */}
                      <div className="pt-0.5 min-w-0">
                        <div
                          className={`text-sm ${
                            m.current
                              ? 'font-semibold text-slate-900'
                              : done
                              ? 'font-medium text-slate-700'
                              : 'font-medium text-slate-500'
                          }`}
                        >
                          {m.label}
                          {m.current && (
                            <span
                              className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold text-white align-middle"
                              style={{ backgroundColor: primary }}
                            >
                              Now
                            </span>
                          )}
                          <span className="sr-only">
                            {m.current ? ' — current step' : done ? ' — completed' : ' — not yet reached'}
                          </span>
                        </div>
                        {m.at && (
                          <div className="text-xs text-slate-500 mt-0.5">{fmtDate(m.at)}</div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>

              {/* Last scan line */}
              {data.lastScan && (
                <div className="mt-2 pt-4 border-t border-slate-100">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Latest update
                  </div>
                  {/* Courier scan text is passed through raw and can be a long
                      unbroken token — let it wrap rather than overflow. */}
                  <div className="text-sm text-slate-700 mt-1 break-words">{data.lastScan.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {[data.lastScan.location, fmtDate(data.lastScan.at)].filter(Boolean).join(' · ')}
                  </div>
                </div>
              )}

              {/* Full journey — every scan the courier sent */}
              {data.journey && data.journey.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  {/* min-h-[44px] for the touch target; the negative margin
                      keeps the visual rhythm the padding would otherwise add. */}
                  <button
                    type="button"
                    onClick={() => setShowJourney((v) => !v)}
                    className="inline-flex items-center min-h-[44px] -my-2.5 text-[13px] font-semibold hover:opacity-80 transition-opacity"
                    style={{ color: primary }}
                    aria-expanded={showJourney}
                  >
                    {showJourney ? 'Hide full journey' : `Show full journey (${data.journey.length} scans)`}
                  </button>
                  {showJourney && (
                    <ol className="mt-3 space-y-3">
                      {data.journey.map((ev, i) => (
                        <li key={i} className="flex gap-3">
                          <span
                            aria-hidden
                            className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${i === 0 ? '' : 'bg-slate-300'}`}
                            style={i === 0 ? { backgroundColor: primary } : undefined}
                          />
                          <div className="min-w-0">
                            <div className="text-sm text-slate-800 break-words">{ev.label}</div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {[ev.location, fmtDate(ev.at)].filter(Boolean).join(' · ')}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </section>
            )}

            {/* RTO notice — replaces the stepper above rather than showing it
                mid-way through forward-delivery rungs. */}
            {isRto && (
              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6 shadow-sm text-center">
                <div className="mx-auto w-11 h-11 rounded-full bg-amber-100 flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                  </svg>
                </div>
                <p className="text-sm text-amber-900 leading-relaxed">
                  This shipment is returning to us. If you still want your order,{' '}
                  <a href={waHelp} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2">
                    chat with us on WhatsApp
                  </a>{' '}
                  and we&apos;ll reship it.
                </p>
              </section>
            )}

            {/* Upsell shelf — highest-intent surface. Keep it inviting, not spammy. */}
            {showUpsell && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h2 className="text-base font-semibold text-slate-900 tracking-tight">
                    {brand?.upsellHeading || 'You may also love'}
                  </h2>
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: `${accent}22`, color: primary }}
                  >
                    Handpicked
                  </span>
                </div>
                {/* Two-up on phones: one-up made three full-width squares the
                    customer had to scroll past to reach the help CTA. */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {data.upsell!.map((item, i) => {
                    const label = isDelivered ? 'Reorder' : 'Shop';
                    return (
                      <div
                        key={`${item.title}-${i}`}
                        className="group flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden transition-shadow duration-200 sm:hover:shadow-md"
                      >
                        <div className="aspect-square w-full bg-slate-50 flex items-center justify-center overflow-hidden">
                          {item.imageUrl ? (
                            // object-contain, not cover: these are Shopify
                            // marketing tiles and a wide wordmark, so cover
                            // would crop the product out of its own card.
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.imageUrl}
                              alt={item.title}
                              loading="lazy"
                              decoding="async"
                              width={400}
                              height={400}
                              className="w-full h-full object-contain sm:group-hover:scale-[1.03] transition-transform duration-200"
                            />
                          ) : (
                            <div
                              className="w-full h-full flex items-center justify-center"
                              style={{ backgroundColor: `${accent}14` }}
                            >
                              <svg
                                className="w-8 h-8"
                                style={{ color: primary, opacity: 0.45 }}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                strokeWidth={1.5}
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col flex-1 p-3">
                          {/* The text block absorbs the slack, so CTAs line up
                              across the row however many lines a title wraps to. */}
                          <div className="flex-1">
                            <div className="text-sm font-medium text-slate-900 leading-tight line-clamp-2">
                              {item.title}
                            </div>
                            {item.subtitle && (
                              <div className="text-xs text-slate-500 mt-1 line-clamp-2">
                                {item.subtitle}
                              </div>
                            )}
                          </div>
                          {item.url ? (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-3 inline-flex items-center justify-center gap-1 px-3 min-h-[44px] rounded-lg text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
                              style={{ backgroundColor: primary }}
                            >
                              {label}
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                              </svg>
                            </a>
                          ) : (
                            <div className="mt-3 text-xs text-slate-500">Coming soon</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Help CTA — stacks on narrow phones. Side-by-side, the button's
                flex-shrink-0 was squeezing the copy to ~120px at 360px wide. */}
            <section
              className="rounded-2xl border p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              style={{ backgroundColor: `${primary}0a`, borderColor: `${primary}26` }}
            >
              <div className="min-w-0">
                <div className="text-base font-semibold text-slate-900">Need help?</div>
                <div className="text-[13px] text-slate-600 mt-0.5">
                  Our team replies fast on WhatsApp{data.maskedPhone ? ` · ${data.maskedPhone}` : ''}.
                </div>
              </div>
              <a
                href={waHelp}
                target="_blank"
                rel="noreferrer"
                className="sm:flex-shrink-0 inline-flex items-center justify-center gap-2 px-4 min-h-[44px] rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90 shadow-sm"
                style={{ backgroundColor: primary }}
              >
                <WaIcon /> WhatsApp us
              </a>
            </section>
          </>
        )}

        {/* Footer */}
        <footer className="pt-2 pb-8 text-center">
          <p className="text-[11px] text-slate-500">
            {brand?.footerMessage || 'WeShuddhs · Dr. Nishant Gupta Ayurveda · 100% Ayurvedic'}
          </p>
        </footer>
      </main>
    </div>
  );
}

// useSearchParams() must sit under a Suspense boundary or Next's production
// build errors ("should be wrapped in a suspense boundary"). The CRM app kept
// the hook at the top level; this standalone port wraps it so `next build`
// stays clean.
export default function TrackPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-gradient-to-b from-emerald-50/60 via-white to-white" />}>
      <TrackPageInner />
    </Suspense>
  );
}

function WaIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}
