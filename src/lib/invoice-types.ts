// Local copy of the invoice data shapes owned by the CRM
// (src/lib/invoice/build-invoice.ts). This app has no DB access — it only
// consumes the CRM's public JSON at /api/public/invoice/[token] — so these
// interfaces exist here purely as the TypeScript contract for that response.

export interface InvoiceItem {
  name: string;
  variant: string;
  qty: number;
  mrp: number | null; // line MRP (× qty), null when no anchor
  price: number; // line sold price (× qty)
}

export type PaymentType = 'prepaid' | 'cod' | 'partial';

export interface InvoiceData {
  orderName: string;
  date: string;
  paymentType: PaymentType;
  customerName: string;
  addressLines: string[];
  phone: string;
  items: InvoiceItem[];
  mrpTotal: number;
  sellSubtotal: number;
  saved: number;
  prepaidDiscount: number; // 0 when not applicable
  shipping: number;
  totalAmount: number; // full order value / amount paid for prepaid
  codDue: number; // payable at delivery (cod + partial)
  advancePaid: number; // partial only
}
