/**
 * Formatting helpers.
 *
 * Dates are rendered in UTC with a fixed locale so the server and the client
 * always produce identical markup — a mismatch here is the classic source of
 * hydration errors in a fixture list.
 */

const DATE = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

const TIME = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
});

export function formatDate(iso: string): string {
  return DATE.format(new Date(iso));
}

export function formatTime(iso: string): string {
  return `${TIME.format(new Date(iso))} UTC`;
}

/** Historical versions have no present-day valuation; they read as a dash. */
export function formatMoney(millions: number | null): string {
  if (millions === null) return '—';
  if (millions >= 1000) return `€${(millions / 1000).toFixed(1)}bn`;
  return `€${millions}m`;
}

/** "3 days" / "6 hours" / "42 minutes" — never a bare timestamp. */
export function timeUntil(iso: string, now: number): string {
  const diff = new Date(iso).getTime() - now;
  if (diff <= 0) return 'Deadline passed';
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} hr`;
  return `${Math.floor(hours / 24)} days`;
}

export function relativeTime(timestamp: number, now: number): string {
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]!);
}

export function initials(name: string): string {
  return name
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}
