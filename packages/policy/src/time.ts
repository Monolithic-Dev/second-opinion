/** Minutes since local midnight (0-1439) in an IANA timezone. */
export function localMinutes(now: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric', hourCycle: 'h23', timeZone: timezone }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}

/** Local calendar day as YYYY-MM-DD in an IANA timezone (daily cap boundary). */
export function localDay(now: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: timezone }).format(now);
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h as number) * 60 + (m as number);
}

/** Is `now` inside [start, end) in the given timezone? The window may wrap midnight; start === end means never. */
export function inQuietHours(now: Date, timezone: string, start: string, end: string): boolean {
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (s === e) return false;
  const t = localMinutes(now, timezone);
  return s > e ? t >= s || t < e : t >= s && t < e;
}
