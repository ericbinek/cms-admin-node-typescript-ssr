import { randomBytes, timingSafeEqual } from 'node:crypto';

// Cookie names are admin-frontend internal; the API never reads them. The
// session cookie carries the API bearer token, the csrf cookie the synchronizer
// token rendered into every form.
export const SESSION_COOKIE = 'cms_session';
export const CSRF_COOKIE = 'cms_csrf';

// Both cookies live at most as long as the API session cap (8h). Secure is on
// only behind HTTPS; set COOKIE_SECURE=true in production. SameSite=Strict and
// HttpOnly are always on — the server renders the csrf token into forms itself,
// so no client script needs to read either cookie.
const MAX_AGE = 60 * 60 * 8;
const COOKIE_SECURE = String(process.env.COOKIE_SECURE || '').toLowerCase() === 'true';

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const name = part.slice(0, idx).trim();
    if (!name) continue;
    out[name] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function serialize(name: string, value: string, maxAge: number): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAge}`,
  ];
  if (COOKIE_SECURE) parts.push('Secure');
  return parts.join('; ');
}

export function setSessionCookie(token: string): string {
  return serialize(SESSION_COOKIE, token, MAX_AGE);
}

export function clearSessionCookie(): string {
  return serialize(SESSION_COOKIE, '', 0);
}

export function setCsrfCookie(token: string): string {
  return serialize(CSRF_COOKIE, token, MAX_AGE);
}

export function randomToken(): string {
  return randomBytes(32).toString('hex');
}

// Constant-time comparison of the cookie token against the submitted form token.
// Unequal lengths or non-strings fail closed without leaking timing.
export function csrfValid(cookieToken: unknown, formToken: unknown): boolean {
  if (typeof cookieToken !== 'string' || typeof formToken !== 'string') return false;
  if (cookieToken.length === 0 || cookieToken.length !== formToken.length) return false;
  return timingSafeEqual(Buffer.from(cookieToken), Buffer.from(formToken));
}
