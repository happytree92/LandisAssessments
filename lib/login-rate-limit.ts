/**
 * Brute-force protection for the login endpoint.
 * Tracks failures per IP+username combination.
 * After MAX_FAILURES failed attempts within WINDOW_MS, the account is locked
 * for LOCKOUT_MS from that IP.
 *
 * In-memory only — resets on server restart. Sufficient for a 2–5 user internal tool.
 * For multi-instance deployments, replace with a Redis-backed store.
 */

interface LockEntry {
  failures: number;
  windowStart: number; // ms timestamp when the window began
  lockedUntil: number | null; // ms timestamp when lockout expires, null if not locked
}

const WINDOW_MS = 15 * 60 * 1000; // 15-minute sliding window
const MAX_FAILURES = 5; // failures before lockout
const LOCKOUT_MS = 15 * 60 * 1000; // 15-minute lockout

const store = new Map<string, LockEntry>();

function key(ip: string, username: string): string {
  return `${ip}:${username.toLowerCase()}`;
}

/**
 * Check whether this IP+username combination is allowed to attempt login.
 * Returns { allowed: true } or { allowed: false, retryAfter: seconds }.
 */
export function checkLoginRateLimit(
  ip: string,
  username: string
): { allowed: true } | { allowed: false; retryAfter: number } {
  const k = key(ip, username);
  const now = Date.now();
  const entry = store.get(k);

  if (!entry) return { allowed: true };

  // Currently locked out?
  if (entry.lockedUntil && entry.lockedUntil > now) {
    return {
      allowed: false,
      retryAfter: Math.ceil((entry.lockedUntil - now) / 1000),
    };
  }

  // Window expired — reset
  if (now - entry.windowStart > WINDOW_MS) {
    store.delete(k);
    return { allowed: true };
  }

  return { allowed: true };
}

/**
 * Record a failed login attempt. Increments failure count and applies lockout if threshold reached.
 */
export function recordLoginFailure(ip: string, username: string): void {
  const k = key(ip, username);
  const now = Date.now();
  const entry = store.get(k);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    store.set(k, { failures: 1, windowStart: now, lockedUntil: null });
    return;
  }

  entry.failures += 1;
  if (entry.failures >= MAX_FAILURES) {
    entry.lockedUntil = now + LOCKOUT_MS;
  }
  store.set(k, entry);
}

/**
 * Clear the failure record on successful login.
 */
export function recordLoginSuccess(ip: string, username: string): void {
  store.delete(key(ip, username));
}
