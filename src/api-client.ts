const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3008';

const PLURALS: Record<string, string> = {
  "BlogPosting": "blog-postings",
  "Person": "persons",
  "WebPage": "web-pages",
  "ImageObject": "image-objects",
  "CategoryCode": "category-codes",
  "CategoryCodeSet": "category-code-sets",
  "DefinedTerm": "defined-terms",
  "DefinedTermSet": "defined-term-sets",
  "Comment": "comments",
  "WebSite": "web-sites",
};

export function pluralOf(entity: string): string {
  if (PLURALS[entity]) return PLURALS[entity];
  throw new Error(`Unknown entity for plural lookup: ${entity}`);
}

export interface ApiResult {
  status: number;
  body: any;
  etag: string | null;
}

// A session-bound client. Every entity call carries the bearer token; a 401
// becomes a SessionExpiredError.
export interface BoundApi {
  list(entity: string, query?: Record<string, unknown>): Promise<ApiResult>;
  get(entity: string, id: string): Promise<ApiResult>;
  create(entity: string, payload: unknown): Promise<ApiResult>;
  update(entity: string, id: string, payload: unknown): Promise<ApiResult>;
  remove(entity: string, id: string): Promise<ApiResult>;
}

// Raised when a bound request gets 401 from the API — the session is invalid or
// expired upstream. The server catches it, clears the cookie, and redirects to
// the login page.
export class SessionExpiredError extends Error {
  constructor() {
    super('Session expired.');
    this.name = 'SessionExpiredError';
  }
}

async function request(
  method: string,
  path: string,
  { token, body }: { token?: string; body?: unknown } = {},
): Promise<ApiResult> {
  const url = new URL(path, API_BASE_URL);
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const init: RequestInit = { method, headers };
  if (body !== undefined && body !== null) {
    init.body = JSON.stringify(body);
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, init);
  const text = await res.text();
  let parsed: any = null;
  if (text) {
    try { parsed = JSON.parse(text); }
    catch { parsed = { raw: text }; }
  }
  return { status: res.status, body: parsed, etag: res.headers.get('etag') };
}

// Auth routes — driven by the server's login/logout flow, not by the views.
// They return the raw status so the server can map credentials to cookies.
export function login(username: string, password: string): Promise<ApiResult> {
  return request('POST', '/auth/login', { body: { username, password } });
}

export function logout(token: string): Promise<ApiResult> {
  return request('POST', '/auth/logout', { token });
}

export function me(token: string): Promise<ApiResult> {
  return request('GET', '/auth/me', { token });
}

export function apiFor(token: string): BoundApi {
  async function authed(method: string, path: string, body?: unknown): Promise<ApiResult> {
    const r = await request(method, path, { token, body });
    if (r.status === 401) throw new SessionExpiredError();
    return r;
  }
  return {
    list(entity: string, query: Record<string, unknown> = {}): Promise<ApiResult> {
      const sp = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null || v === '') continue;
        sp.set(k, String(v));
      }
      const qs = sp.toString();
      return authed('GET', `/${pluralOf(entity)}${qs ? '?' + qs : ''}`);
    },
    get(entity: string, id: string): Promise<ApiResult> {
      return authed('GET', `/${pluralOf(entity)}/${encodeURIComponent(id)}`);
    },
    create(entity: string, payload: unknown): Promise<ApiResult> {
      return authed('POST', `/${pluralOf(entity)}`, payload);
    },
    update(entity: string, id: string, payload: unknown): Promise<ApiResult> {
      return authed('PUT', `/${pluralOf(entity)}/${encodeURIComponent(id)}`, payload);
    },
    remove(entity: string, id: string): Promise<ApiResult> {
      return authed('DELETE', `/${pluralOf(entity)}/${encodeURIComponent(id)}`);
    },
  };
}
