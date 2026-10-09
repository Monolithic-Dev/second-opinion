import type { HoldStatus } from './types';

export function formatMoney(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—';
  const whole = cents % 100 === 0;
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}

/** "just now", "5 min ago", "3 h ago", "2 days ago". `now` is injectable for tests. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const s = Math.round((now.getTime() - Date.parse(iso)) / 1000);
  if (!Number.isFinite(s)) return '';
  if (s < 0) return 'soon';
  if (s < 45) return 'just now';
  if (s < 90) return '1 min ago';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

/** "in 8 min" / "expired" for a pending hold. */
export function timeLeft(iso: string, now: Date = new Date()): string {
  const s = Math.round((Date.parse(iso) - now.getTime()) / 1000);
  if (!Number.isFinite(s)) return '';
  if (s <= 0) return 'expired';
  if (s < 90) return `${s} s left`;
  return `${Math.round(s / 60)} min left`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function formatDuration(sec: number | null): string {
  if (sec === null) return '—';
  if (sec < 60) return `${Math.round(sec)} s`;
  if (sec < 3600) return `${Math.round(sec / 60)} min`;
  return `${(sec / 3600).toFixed(1)} h`;
}

export const STATUS_LABEL: Record<HoldStatus, { label: string; tone: 'ok' | 'warn' | 'danger' | 'info' | 'neutral' }> = {
  pending: { label: 'Waiting for you', tone: 'warn' },
  approved: { label: 'Approved', tone: 'ok' },
  released: { label: 'Approved', tone: 'ok' },
  denied: { label: 'Cancelled', tone: 'danger' },
  expired: { label: 'Expired, stayed blocked', tone: 'neutral' },
};

export const SIGNAL_LABEL: Record<string, string> = {
  GIFT_CARD: 'Gift cards', WIRE_OR_CRYPTO: 'Wire / crypto', REMOTE_ACCESS: 'Remote access', VERIFICATION_CODE: 'Security code',
  FAMILY_EMERGENCY: 'Family emergency', PRIZE_OR_LOTTERY: 'Prize with a fee', AUTHORITY_IMPERSONATION: 'Posing as an official',
  SECRECY: 'Secrecy', URGENCY: 'Pressure to act now', UNSOLICITED_CONTACT: 'Unrequested contact', NEW_PAYEE: 'New payee',
  HIGH_AMOUNT: 'Large amount', PLAYBOOK_MATCH: 'Known scam pattern', AMOUNT_ANOMALY: 'Unusual amount', PAYEE_VELOCITY: 'Many new payees',
  QUIET_HOURS: 'Unusual hour', RETRY_AFTER_DENY: 'Retry after "no"',
};
