// The CRM's public API base. The public app talks to the CRM ONLY through the
// scoped public endpoints (/api/public/invoice, /api/shipping/track-public).
// Override with CRM_API_BASE in the environment if needed.
export const CRM_API = (process.env.CRM_API_BASE || 'https://crm.weshuddhs.in').replace(/\/+$/, '');
