/**
 * Simple in-memory rate limiter for public endpoints.
 * Resets per IP per hour. Sufficient for low-traffic self-assessment URLs.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number; // unix ms
}

const store = new Map<string, RateLimitEntry>();

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS = 10;

/**
 * Returns true if the request is allowed, false if rate limited.
 * Increments the counter for the given IP.
 */
export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || entry.resetAt < now) {
    store.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (entry.count >= MAX_REQUESTS) {
    return false;
  }

  entry.count++;
  return true;
}
