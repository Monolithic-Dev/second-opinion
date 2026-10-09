import type { NotifyKind, HoldPayload } from './types';

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function money(cents: number | null): string {
  return cents === null ? 'an amount' : `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: cents % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
}

const SUBJECT: Record<NotifyKind, (p: HoldPayload) => string> = {
  hold_requested: (p) => `Please review: ${p.description} (${money(p.amountCents)})`,
  hold_escalated: (p) => `Still waiting on a decision: ${p.description}`,
  hold_resolved: (p) => `${p.status === 'released' ? 'Approved' : p.status === 'expired' ? 'Expired (stayed blocked)' : 'Cancelled'}: ${p.description}`,
};

export interface Rendered {
  subject: string;
  text: string;
  html: string;
}

/**
 * Render an approver notification. Every dynamic value is HTML-escaped. Text only: no links, no remote images.
 * (Delivery is simulated in this build: the HTML is written to disk, nothing is sent.)
 */
export function renderNotification(kind: NotifyKind, p: HoldPayload): Rendered {
  const subject = SUBJECT[kind](p);
  const lead =
    kind === 'hold_requested' ? `${p.recipientName}, a request was paused and needs your decision.`
    : kind === 'hold_escalated' ? `${p.recipientName}, this paused request has not been decided yet.`
    : `${p.recipientName}, this request is now ${p.status ?? 'closed'}.`;
  const lines = [lead, `What: ${p.description}`, `Amount: ${money(p.amountCents)}`];
  if (p.flags.length) lines.push(`Why it looks risky: ${p.flags.join('; ')}`);
  if (p.reasonText.length) lines.push(`Household rules: ${p.reasonText.join('; ')}`);
  if (kind !== 'hold_resolved') lines.push(`Expires: ${p.expiresAt}`, 'If nobody decides in time, the request stays blocked.');
  const text = lines.join('\n');

  const li = (items: string[]) => (items.length ? `<ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>` : '');
  const html =
    `<!doctype html><html lang="en"><meta charset="utf-8"><title>${escapeHtml(subject)}</title>` +
    `<body style="font-family:system-ui,sans-serif;max-width:560px;margin:24px auto;line-height:1.5">` +
    `<h1 style="font-size:20px">${escapeHtml(subject)}</h1>` +
    `<p>${escapeHtml(lead)}</p>` +
    `<p><strong>${escapeHtml(p.description)}</strong><br>${escapeHtml(money(p.amountCents))}</p>` +
    (p.flags.length ? `<h2 style="font-size:16px">Why it looks risky</h2>${li(p.flags)}` : '') +
    (p.reasonText.length ? `<h2 style="font-size:16px">Household rules</h2>${li(p.reasonText)}` : '') +
    (kind !== 'hold_resolved' ? `<p>Expires ${escapeHtml(p.expiresAt)}. If nobody decides in time, the request stays blocked.</p>` : '') +
    `<p style="color:#666;font-size:12px">Second Opinion demo. Simulated message, nothing was sent.</p></body></html>`;
  return { subject, text, html };
}
