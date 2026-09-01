import { CRM_API } from '@/lib/config';
import type { InvoiceData } from '@/lib/invoice-types';

export const dynamic = 'force-dynamic';

const LOGO = 'https://cdn.shopify.com/s/files/1/0883/2948/6617/files/foter-logo.png';
const rup = (v: number) => '₹' + Math.round(v).toLocaleString('en-IN');

const CSS = `
.invw{max-width:640px;margin:0 auto;background:#fff;color:#12283C;font-family:-apple-system,"Segoe UI",Roboto,"Noto Sans Devanagari",sans-serif;min-height:100vh}
.invw *{box-sizing:border-box}
.inv-band{display:flex;align-items:center;padding:20px 22px 14px}
.inv-band img{height:40px}
.inv-band .r{margin-left:auto;text-align:right}
.inv-band .t{font-size:18px;font-weight:800;letter-spacing:.14em;color:#052A49}
.inv-band .trk{font-size:10px;color:#4C7A00;font-weight:700;margin-top:3px}
.inv-band .trk a{color:#052A49;text-decoration:none}
.inv-strip{height:4px;background:#8ECC06}
.inv-body{padding:18px 22px 28px}
.inv-meta{display:flex;gap:8px;margin-bottom:16px}
.inv-meta>div{flex:1}
.inv-meta>div:nth-child(2){text-align:center}
.inv-meta>div:last-child{text-align:right}
.inv-meta .lbl{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#8A97A2;margin-bottom:3px}
.inv-meta .v{font-size:15px;font-weight:700;color:#052A49}
.inv-parties{display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap}
.inv-party{flex:1;min-width:200px;background:#F6F7F2;border-radius:10px;padding:11px 14px}
.inv-party .lbl{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#8A97A2;margin-bottom:4px}
.inv-party .nm{font-size:13px;font-weight:700}
.inv-party .ad{font-size:11.5px;color:#43535F;line-height:1.5;margin-top:2px}
.inv-tablewrap{overflow-x:auto}
.inv-table{width:100%;border-collapse:collapse;min-width:340px}
.inv-table thead td{font-size:9px;letter-spacing:.05em;text-transform:uppercase;color:#8A97A2;padding:0 0 7px;border-bottom:1.5px solid #052A49}
.inv-table thead td.cc{text-align:center}
.inv-table tbody td{padding:9px 0;border-bottom:1px solid #ECEEE8;vertical-align:top}
.inv-table .sn{width:22px;color:#A6ADB4;font-size:12px}
.inv-table .it{font-size:13px;font-weight:600}
.inv-table .qc{text-align:center;width:38px;font-size:13px}
.inv-table .cc{text-align:center;width:84px;font-variant-numeric:tabular-nums;font-size:13px}
.inv-table .mrp{color:#8A97A2;text-decoration:line-through}
.inv-table .pr{font-weight:700;color:#052A49}
.inv-sum{margin:12px 0 0 auto;max-width:320px}
.inv-sum .row{display:flex;justify-content:space-between;padding:4px 0;font-size:13px}
.inv-sum .row.save{color:#4C7A00;font-weight:600}
.inv-sum .row.tot{border-top:1.5px solid #052A49;margin-top:5px;padding-top:9px;font-size:17px;font-weight:800;color:#052A49}
.inv-pay{margin-top:16px;display:flex;align-items:center;flex-wrap:wrap;gap:8px}
.inv-pill{font-size:12px;font-weight:800;letter-spacing:.04em;padding:7px 16px;border-radius:7px}
.inv-pill.paid{background:#EFF5E2;color:#3F6600}
.inv-pill.cod{background:#FFF4E0;color:#8A5A00}
.inv-pill.partial{background:#E7F0FA;color:#1B4F7E}
.inv-pay .m{margin-left:auto;font-size:10.5px;color:#8A97A2}
.inv-foot{margin-top:24px;padding-top:14px;border-top:1px solid #E4E6DF;text-align:center}
.inv-foot .ty{color:#4C7A00;font-weight:700;font-size:12px;margin-bottom:6px}
.inv-foot .row1{font-size:11px;color:#8A97A2;line-height:1.7}
.inv-foot b{color:#43535F}
.inv-nf{max-width:420px;margin:80px auto;text-align:center;font-family:-apple-system,"Segoe UI",Roboto,sans-serif;color:#43535F;padding:0 24px}
.inv-nf h1{font-size:19px;color:#052A49}
`;

interface SumRow {
  label: string;
  value: string;
  cls?: string;
}

function summaryRows(inv: InvoiceData): SumRow[] {
  const rows: SumRow[] = [{ label: 'Total MRP', value: rup(inv.mrpTotal) }];
  if (inv.saved > 0) rows.push({ label: 'You Saved', value: '−' + rup(inv.saved), cls: 'save' });
  if (inv.paymentType === 'prepaid') {
    if (inv.prepaidDiscount > 0)
      rows.push({ label: 'Prepaid Payment Discount', value: '−' + rup(inv.prepaidDiscount), cls: 'save' });
    rows.push({ label: 'Shipping', value: inv.shipping > 0 ? rup(inv.shipping) : 'FREE' });
    rows.push({ label: 'Total Paid', value: rup(inv.totalAmount), cls: 'tot' });
  } else if (inv.paymentType === 'cod') {
    rows.push({ label: 'Shipping', value: inv.shipping > 0 ? rup(inv.shipping) : 'FREE' });
    rows.push({ label: 'Amount Payable (COD)', value: rup(inv.codDue), cls: 'tot' });
  } else {
    rows.push({ label: 'Shipping', value: inv.shipping > 0 ? rup(inv.shipping) : 'FREE' });
    rows.push({ label: 'Order Total', value: rup(inv.totalAmount) });
    rows.push({ label: 'Advance Paid Online', value: '−' + rup(inv.advancePaid), cls: 'save' });
    rows.push({ label: 'Balance Payable (COD)', value: rup(inv.codDue), cls: 'tot' });
  }
  return rows;
}

function pill(inv: InvoiceData): { cls: string; text: string } {
  if (inv.paymentType === 'prepaid') return { cls: 'paid', text: 'PAID ONLINE' };
  if (inv.paymentType === 'cod') return { cls: 'cod', text: 'COD — PAY AT DELIVERY' };
  return { cls: 'partial', text: 'PARTIALLY PAID' };
}

const payLabel = (t: InvoiceData['paymentType']) =>
  t === 'prepaid' ? 'Prepaid' : t === 'cod' ? 'COD' : 'Partial (COD)';

async function fetchInvoice(token: string): Promise<InvoiceData | null> {
  try {
    const res = await fetch(`${CRM_API}/api/public/invoice/${encodeURIComponent(token)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as (InvoiceData & { error?: string }) | { error: string };
    if (!data || 'error' in data) return null;
    return data as InvoiceData;
  } catch {
    return null;
  }
}

export default async function InvoicePage({ params }: { params: { token: string } }) {
  const inv = await fetchInvoice(params.token);

  if (!inv) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="inv-nf">
          <h1>Invoice not available</h1>
          <p>This link is invalid or has expired. Please contact us at +91 94123 04567 or support@weshuddhs.in.</p>
        </div>
      </>
    );
  }

  const p = pill(inv);
  const rows = summaryRows(inv);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="invw">
        <div className="inv-band">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="WeShuddhs" />
          <div className="r">
            <div className="t">INVOICE</div>
            <div className="trk">
              Track: <a href="https://track.weshuddhs.in">track.weshuddhs.in</a>
            </div>
          </div>
        </div>
        <div className="inv-strip" />
        <div className="inv-body">
          <div className="inv-meta">
            <div>
              <div className="lbl">Invoice / Order No.</div>
              <div className="v">{inv.orderName}</div>
            </div>
            <div>
              <div className="lbl">Date</div>
              <div className="v">{inv.date}</div>
            </div>
            <div>
              <div className="lbl">Payment</div>
              <div className="v">{payLabel(inv.paymentType)}</div>
            </div>
          </div>

          <div className="inv-parties">
            <div className="inv-party">
              <div className="lbl">Billed / Shipped To</div>
              <div className="nm">{inv.customerName}</div>
              <div className="ad">
                {inv.addressLines.map((l, i) => (
                  <div key={i}>{l}</div>
                ))}
                {inv.phone ? <div>{inv.phone}</div> : null}
              </div>
            </div>
            <div className="inv-party">
              <div className="lbl">Sold By</div>
              <div className="nm">WeShuddhs</div>
              <div className="ad">
                weshuddhs.in
                <br />
                Help: +91 94123 04567
                <br />
                support@weshuddhs.in
              </div>
            </div>
          </div>

          <div className="inv-tablewrap">
            <table className="inv-table">
              <thead>
                <tr>
                  <td className="sn">#</td>
                  <td>Item</td>
                  <td className="cc">Qty</td>
                  <td className="cc">MRP</td>
                  <td className="cc">Discounted</td>
                </tr>
              </thead>
              <tbody>
                {inv.items.map((it, i) => (
                  <tr key={i}>
                    <td className="sn">{i + 1}</td>
                    <td className="it">
                      {it.name}
                      {it.variant ? ' ' + it.variant : ''}
                    </td>
                    <td className="qc">{it.qty}</td>
                    <td className="cc mrp">{it.mrp != null ? rup(it.mrp) : '—'}</td>
                    <td className="cc pr">{rup(it.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="inv-sum">
            {rows.map((r, i) => (
              <div key={i} className={'row' + (r.cls ? ' ' + r.cls : '')}>
                <span>{r.label}</span>
                <span>{r.value}</span>
              </div>
            ))}
          </div>

          <div className="inv-pay">
            <span className={'inv-pill ' + p.cls}>{p.text}</span>
            <span className="m">Prices inclusive of all taxes</span>
          </div>

          <div className="inv-foot">
            <div className="ty">Thank you for choosing WeShuddhs 🙏</div>
            <div className="row1">
              Help: <b>+91 94123 04567</b> · <b>support@weshuddhs.in</b>
              <br />
              <b>weshuddhs.in</b>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
