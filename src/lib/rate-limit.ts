const attempts = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  max = 5,
  windowMs = 60_000
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }
  if (entry.count >= max) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count++;
  return { allowed: true };
}
