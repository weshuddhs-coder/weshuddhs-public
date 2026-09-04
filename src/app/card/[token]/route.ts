// Per-order receipt card — the image header on the WhatsApp order
// confirmation. Renders on demand from the CRM's scoped invoice API (so the
// card always reflects the order that owns the token) and is fetched by Meta
// at send time via  https://track.weshuddhs.in/card/<invoiceToken>.png
//
// Drawn with @napi-rs/canvas + bundled Noto Sans / Noto Sans Devanagari, because
// the hosting containers ship with no fonts at all. Design mirrors the card the
// owner approved: logo · status badge · "Order #… · date" · dashed rules ·
// item rows with line prices · total row with PAID / COD / PARTIAL pill.
// 1600×836 = 2× of WhatsApp's 1.91:1 header (800×418).

import { NextResponse } from 'next/server';
import path from 'node:path';
import { createCanvas, GlobalFonts, loadImage, type SKRSContext2D } from '@napi-rs/canvas';
import { CRM_API } from '@/lib/config';
import type { InvoiceData } from '@/lib/invoice-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const W = 1600;
const H = 836;
const PAD_X = 68;
const NAVY = '#052A49';
const INK = '#12283C';
const GREY = '#7B8790';
const RULE = '#D3D5CB';

let fontsReady = false;
function ensureFonts() {
  if (fontsReady) return;
  const dir = path.join(process.cwd(), 'assets', 'fonts');
  GlobalFonts.registerFromPath(path.join(dir, 'NotoSans-Regular.ttf'), 'Noto Sans');
  GlobalFonts.registerFromPath(path.join(dir, 'NotoSans-Bold.ttf'), 'Noto Sans');
  GlobalFonts.registerFromPath(path.join(dir, 'NotoSansDevanagari-Regular.ttf'), 'Noto Sans Devanagari');
  GlobalFonts.registerFromPath(path.join(dir, 'NotoSansDevanagari-Bold.ttf'), 'Noto Sans Devanagari');
  fontsReady = true;
}
const FAM = '"Noto Sans", "Noto Sans Devanagari"';

let logoCache: { buf: Buffer; at: number } | null = null;
async function getLogo(): Promise<Buffer | null> {
  if (logoCache && Date.now() - logoCache.at < 6 * 3600_000) return logoCache.buf;
  try {
    const res = await fetch(`${CRM_API}/api/brand/logo`, { cache: 'no-store' });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    logoCache = { buf, at: Date.now() };
    return buf;
  } catch {
    return null;
  }
}

const rup = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

function roundRect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number, fill: string) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function dashedRule(ctx: SKRSContext2D, y: number) {
  ctx.save();
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 4;
  ctx.setLineDash([16, 12]);
  ctx.beginPath();
  ctx.moveTo(PAD_X, y);
  ctx.lineTo(W - PAD_X, y);
  ctx.stroke();
  ctx.restore();
}

/** Trim a string to fit `maxW` px in the current font, adding an ellipsis. */
function fit(ctx: SKRSContext2D, s: string, maxW: number): string {
  if (ctx.measureText(s).width <= maxW) return s;
  let t = s;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

function drawCard(ctx: SKRSContext2D, inv: InvoiceData, logo: Buffer | null, logoImg: Awaited<ReturnType<typeof loadImage>> | null) {
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  // ── Header: logo left, badge right ─────────────────────────────────────
  const top = 52;
  if (logoImg) {
    const h = 108;
    const w = (logoImg.width / logoImg.height) * h;
    ctx.drawImage(logoImg, PAD_X, top, w, h);
  }
  const badge =
    inv.paymentType === 'prepaid'
      ? { text: 'ORDER CONFIRMED ✓', bg: '#EFF5E2', fg: '#3F6600' }
      : inv.paymentType === 'partial'
        ? { text: 'ORDER CONFIRMED ✓', bg: '#E7F0FA', fg: '#1B4F7E' }
        : { text: 'ORDER RECEIVED', bg: '#FFF4E0', fg: '#8A5A00' };
  ctx.font = `bold 32px ${FAM}`;
  const bw = ctx.measureText(badge.text).width + 72;
  roundRect(ctx, W - PAD_X - bw, top + 18, bw, 72, 18, badge.bg);
  ctx.fillStyle = badge.fg;
  ctx.textBaseline = 'middle';
  ctx.fillText(badge.text, W - PAD_X - bw + 36, top + 18 + 36);

  // ── Order line ─────────────────────────────────────────────────────────
  ctx.textBaseline = 'alphabetic';
  let y = top + 108 + 78;
  ctx.font = `bold 60px ${FAM}`;
  ctx.fillStyle = NAVY;
  ctx.fillText(`Order ${inv.orderName}`, PAD_X, y);
  const ow = ctx.measureText(`Order ${inv.orderName}`).width;
  ctx.font = `30px ${FAM}`;
  ctx.fillStyle = GREY;
  ctx.fillText(`· ${inv.date}`, PAD_X + ow + 20, y - 2);

  // ── Items ──────────────────────────────────────────────────────────────
  y += 44;
  dashedRule(ctx, y);
  const bottomRuleY = H - 52 - 78 - 40; // leave room for the total row
  const maxRows = 4;
  const rows = inv.items.slice(0, inv.items.length > maxRows ? maxRows - 1 : maxRows);
  const extra = inv.items.length - rows.length;
  const rowH = Math.min(96, Math.floor((bottomRuleY - y - 24) / Math.max(1, rows.length + (extra > 0 ? 1 : 0))));
  let ry = y + 24 + rowH * 0.62;
  for (const it of rows) {
    ctx.font = `50px ${FAM}`;
    ctx.fillStyle = INK;
    const name = `${it.name}${it.variant ? ' ' + it.variant : ''}`;
    ctx.font = `50px ${FAM}`;
    const priceStr = rup(it.price);
    const pw = ctx.measureText(priceStr).width;
    const qtyStr = ` ×${it.qty}`;
    ctx.font = `40px ${FAM}`;
    const qw = ctx.measureText(qtyStr).width;
    ctx.font = `50px ${FAM}`;
    const nameFit = fit(ctx, name, W - PAD_X * 2 - pw - qw - 60);
    ctx.fillText(nameFit, PAD_X, ry);
    const nw = ctx.measureText(nameFit).width;
    ctx.font = `40px ${FAM}`;
    ctx.fillStyle = GREY;
    ctx.fillText(qtyStr, PAD_X + nw, ry);
    ctx.font = `50px ${FAM}`;
    ctx.fillStyle = INK;
    ctx.fillText(priceStr, W - PAD_X - pw, ry);
    ry += rowH;
  }
  if (extra > 0) {
    ctx.font = `40px ${FAM}`;
    ctx.fillStyle = GREY;
    ctx.fillText(`+${extra} more item${extra > 1 ? 's' : ''}`, PAD_X, ry);
  }
  dashedRule(ctx, bottomRuleY);

  // ── Total row ──────────────────────────────────────────────────────────
  const ty = H - 52 - 30;
  let label: string;
  let amount: number;
  let pill: { text: string; bg: string; fg: string };
  let sub: string | null = null;
  if (inv.paymentType === 'prepaid') {
    label = 'Total Paid / कुल';
    amount = inv.totalAmount;
    pill = { text: 'PAID', bg: '#EFF5E2', fg: '#3F6600' };
  } else if (inv.paymentType === 'partial') {
    label = 'Pay at Delivery / देय';
    amount = inv.codDue;
    pill = { text: 'PARTIAL', bg: '#E7F0FA', fg: '#1B4F7E' };
    sub = `${rup(inv.advancePaid)} advance paid online ✓`;
  } else {
    label = 'Pay at Delivery / देय';
    amount = inv.codDue;
    pill = { text: 'COD', bg: '#FFF4E0', fg: '#8A5A00' };
  }
  ctx.font = `bold 54px ${FAM}`;
  ctx.fillStyle = NAVY;
  ctx.fillText(label, PAD_X, ty);
  ctx.font = `bold 32px ${FAM}`;
  const pw2 = ctx.measureText(pill.text).width + 56;
  roundRect(ctx, W - PAD_X - pw2, ty - 44, pw2, 60, 16, pill.bg);
  ctx.fillStyle = pill.fg;
  ctx.textBaseline = 'middle';
  ctx.fillText(pill.text, W - PAD_X - pw2 + 28, ty - 14);
  ctx.textBaseline = 'alphabetic';
  ctx.font = `bold 54px ${FAM}`;
  ctx.fillStyle = NAVY;
  const aw = ctx.measureText(rup(amount)).width;
  ctx.fillText(rup(amount), W - PAD_X - pw2 - 24 - aw, ty);
  if (sub) {
    ctx.font = `28px ${FAM}`;
    ctx.fillStyle = GREY;
    const sw = ctx.measureText(sub).width;
    ctx.fillText(sub, W - PAD_X - sw, ty + 40);
  }
  void logo;
}

/** Generic fallback so a bad/expired token still yields a valid header image. */
function drawFallback(ctx: SKRSContext2D, logoImg: Awaited<ReturnType<typeof loadImage>> | null) {
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);
  if (logoImg) {
    const h = 108;
    ctx.drawImage(logoImg, PAD_X, 52, (logoImg.width / logoImg.height) * h, h);
  }
  ctx.fillStyle = NAVY;
  ctx.font = `bold 96px ${FAM}`;
  ctx.textAlign = 'center';
  ctx.fillText('Order Confirmed', W / 2, H / 2 + 10);
  ctx.font = `44px ${FAM}`;
  ctx.fillStyle = GREY;
  ctx.fillText('ऑर्डर कन्फर्म हो गया है', W / 2, H / 2 + 80);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#8ECC06';
  ctx.fillRect(0, H - 12, W, 12);
}

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  ensureFonts();
  const token = decodeURIComponent(params.token).replace(/\.png$/i, '');

  let inv: InvoiceData | null = null;
  try {
    const res = await fetch(`${CRM_API}/api/public/invoice/${encodeURIComponent(token)}`, { cache: 'no-store' });
    if (res.ok) {
      const j = (await res.json()) as InvoiceData & { error?: string };
      if (!j.error) inv = j;
    }
  } catch {
    /* fall through to fallback */
  }

  const logo = await getLogo();
  let logoImg: Awaited<ReturnType<typeof loadImage>> | null = null;
  if (logo) {
    try {
      logoImg = await loadImage(logo);
    } catch {
      logoImg = null;
    }
  }

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  if (inv) drawCard(ctx, inv, logo, logoImg);
  else drawFallback(ctx, logoImg);

  const png = await canvas.encode('png');
  // Uint8Array is a valid BodyInit; Node's Buffer subtype trips the DOM typings.
  return new NextResponse(new Uint8Array(png), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': String(png.length),
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
