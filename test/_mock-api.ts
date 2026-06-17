// Tiny in-memory mock of the CMS API for admin conformance tests.
// It mirrors the real API's wire envelope ({ items, total }, { id, ...item },
// { status, error, message, details, path }) AND its auth contract: /auth/login
// issues an opaque bearer token, /auth/me and /auth/logout validate it, and every
// entity route requires a live session (401 without). RBAC is the real API's job;
// here the seeded admin has full access, which is enough to prove the admin
// frontend's cookie-to-bearer proxy and CSRF handling.

import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';

interface MockSchema {
  plural: string;
  required: string[];
}
interface MockError {
  status: number;
  error: string;
  message: string;
  details: string[];
  path: string;
}
interface MockAccount {
  id: string;
  username: string;
  role: string;
}

const SCHEMAS: Record<string, MockSchema> = {
  "BlogPosting": {
    "plural": "blog-postings",
    "required": [
      "headline",
      "articleBody",
      "author"
    ]
  },
  "Person": {
    "plural": "persons",
    "required": [
      "name"
    ]
  },
  "Organization": {
    "plural": "organizations",
    "required": [
      "name"
    ]
  },
  "WebPage": {
    "plural": "web-pages",
    "required": [
      "headline"
    ]
  },
  "ImageObject": {
    "plural": "image-objects",
    "required": [
      "contentUrl"
    ]
  },
  "VideoObject": {
    "plural": "video-objects",
    "required": [
      "contentUrl"
    ]
  },
  "AudioObject": {
    "plural": "audio-objects",
    "required": [
      "contentUrl"
    ]
  },
  "CategoryCode": {
    "plural": "category-codes",
    "required": [
      "name",
      "codeValue",
      "inCodeSet"
    ]
  },
  "CategoryCodeSet": {
    "plural": "category-code-sets",
    "required": [
      "name"
    ]
  },
  "DefinedTerm": {
    "plural": "defined-terms",
    "required": [
      "name",
      "termCode",
      "inDefinedTermSet"
    ]
  },
  "DefinedTermSet": {
    "plural": "defined-term-sets",
    "required": [
      "name"
    ]
  },
  "Comment": {
    "plural": "comments",
    "required": [
      "text",
      "author",
      "about"
    ]
  },
  "WebSite": {
    "plural": "web-sites",
    "required": [
      "name",
      "url"
    ]
  },
  "SiteNavigationElement": {
    "plural": "site-navigation-elements",
    "required": [
      "name",
      "url"
    ]
  }
};
const ENTITY_BY_PLURAL: Record<string, string> = Object.fromEntries(
  Object.entries(SCHEMAS).map(([name, s]) => [s.plural, name])
);

export const ADMIN_USERNAME = 'admin';
export const ADMIN_PASSWORD = 'admin-password';

function jsonResponse(res: ServerResponse, status: number, payload?: unknown): void {
  if (status === 204) { res.writeHead(204); res.end(); return; }
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function errorResponse(status: number, error: string, message: string, details: string[] = [], path = ''): MockError {
  return { status, error, message, details, path };
}

function unauthorized(requestPath: string): MockError {
  return errorResponse(401, 'UNAUTHORIZED', 'Authentication is required, or the session is invalid or expired.', [], requestPath);
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf-8');
  if (!raw) return {};
  try { return JSON.parse(raw) as Record<string, unknown>; }
  catch { const e: NodeJS.ErrnoException = new Error('Invalid JSON'); e.code = 'INVALID_JSON'; throw e; }
}

function validateRequired(entity: string, data: Record<string, unknown>, partial: boolean): string[] {
  if (partial) return [];
  const missing: string[] = [];
  for (const field of SCHEMAS[entity].required) {
    const v = data[field];
    const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
    if (empty) missing.push(`Field "${field}" is required.`);
  }
  return missing;
}

function bearerToken(req: IncomingMessage): string | null {
  const header = req.headers['authorization'];
  if (!header) return null;
  const m = /^Bearer (.+)$/.exec(header.trim());
  return m ? m[1] : null;
}

export function createMockApi(): Server {
  const store: Record<string, Map<string, Record<string, unknown>>> =
    Object.fromEntries(Object.keys(SCHEMAS).map((name) => [name, new Map()]));
  const admin: MockAccount = { id: randomUUID(), username: ADMIN_USERNAME, role: 'admin' };
  const sessions = new Map<string, MockAccount>(); // token -> account

  function accountFor(req: IncomingMessage): MockAccount | null {
    const token = bearerToken(req);
    if (!token) return null;
    return sessions.get(token) || null;
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const { pathname } = url;
    const method = req.method ?? '';
    const requestPath = `${method} ${pathname}`;

    try {
      if (method === 'GET' && pathname === '/health') {
        return jsonResponse(res, 200, { status: 'ok' });
      }

      if (pathname === '/auth/login') {
        if (method !== 'POST') return jsonResponse(res, 405, errorResponse(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.', [], requestPath));
        const data = await readJsonBody(req);
        if (typeof data.username !== 'string' || typeof data.password !== 'string') {
          return jsonResponse(res, 400, errorResponse(400, 'VALIDATION_ERROR', 'Invalid request data.', ['Fields "username" and "password" are required.'], requestPath));
        }
        if (data.username !== ADMIN_USERNAME || data.password !== ADMIN_PASSWORD) {
          return jsonResponse(res, 401, unauthorized(requestPath));
        }
        const token = randomUUID();
        sessions.set(token, admin);
        return jsonResponse(res, 200, {
          token,
          account: { id: admin.id, username: admin.username, role: admin.role },
          expiresAt: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
        });
      }

      if (pathname === '/auth/logout') {
        if (method !== 'POST') return jsonResponse(res, 405, errorResponse(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.', [], requestPath));
        const token = bearerToken(req);
        if (!token || !sessions.has(token)) return jsonResponse(res, 401, unauthorized(requestPath));
        sessions.delete(token);
        return jsonResponse(res, 204);
      }

      if (pathname === '/auth/me') {
        if (method !== 'GET') return jsonResponse(res, 405, errorResponse(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.', [], requestPath));
        const account = accountFor(req);
        if (!account) return jsonResponse(res, 401, unauthorized(requestPath));
        return jsonResponse(res, 200, { account: { id: account.id, username: account.username, role: account.role } });
      }

      // Every entity route requires a live session.
      const account = accountFor(req);
      if (!account) return jsonResponse(res, 401, unauthorized(requestPath));

      const seg = pathname.split('/').filter(Boolean);
      if (seg.length < 1 || seg.length > 2) {
        return jsonResponse(res, 404, errorResponse(404, 'ROUTE_NOT_FOUND', 'No route matches this request.', [], requestPath));
      }
      const entity = ENTITY_BY_PLURAL[seg[0]];
      if (!entity) {
        return jsonResponse(res, 404, errorResponse(404, 'ROUTE_NOT_FOUND', 'No route matches this request.', [], requestPath));
      }

      const collection = store[entity];

      if (seg.length === 1) {
        if (method === 'GET') {
          const items = [...collection.values()];
          const sort = url.searchParams.get('sort') || 'dateCreated';
          const order = url.searchParams.get('order') === 'asc' ? 1 : -1;
          items.sort((a, b) => {
            const va: any = a[sort] ?? ''; const vb: any = b[sort] ?? '';
            return va < vb ? -1 * order : va > vb ? 1 * order : 0;
          });
          const total = items.length;
          const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
          const offset = parseInt(url.searchParams.get('offset') || '0', 10);
          return jsonResponse(res, 200, { items: items.slice(offset, offset + limit), total });
        }
        if (method === 'POST') {
          const data = await readJsonBody(req);
          const errors = validateRequired(entity, data, false);
          if (errors.length) return jsonResponse(res, 400, errorResponse(400, 'VALIDATION_ERROR', 'Invalid request data.', errors, requestPath));
          const now = new Date().toISOString();
          const item: Record<string, unknown> = {
            '@context': 'https://schema.org',
            '@type': entity,
            ...data,
            id: randomUUID(),
            dateCreated: now,
            dateModified: now,
          };
          collection.set(item.id as string, item);
          return jsonResponse(res, 201, item);
        }
        return jsonResponse(res, 405, errorResponse(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.', [], requestPath));
      }

      const id = seg[1].toLowerCase();
      const current = collection.get(id);

      if (method === 'GET') {
        if (!current) return jsonResponse(res, 404, errorResponse(404, 'NOT_FOUND', entity + ' not found.', [], requestPath));
        return jsonResponse(res, 200, current);
      }
      if (method === 'PUT') {
        if (!current) return jsonResponse(res, 404, errorResponse(404, 'NOT_FOUND', entity + ' not found.', [], requestPath));
        const data = await readJsonBody(req);
        const errors = validateRequired(entity, data, true);
        if (errors.length) return jsonResponse(res, 400, errorResponse(400, 'VALIDATION_ERROR', 'Invalid request data.', errors, requestPath));
        const updated: Record<string, unknown> = { ...current, ...data, id: current.id, dateCreated: current.dateCreated, dateModified: new Date().toISOString(), '@context': current['@context'], '@type': current['@type'] };
        collection.set(id, updated);
        return jsonResponse(res, 200, updated);
      }
      if (method === 'DELETE') {
        if (!current) return jsonResponse(res, 404, errorResponse(404, 'NOT_FOUND', entity + ' not found.', [], requestPath));
        collection.delete(id);
        return jsonResponse(res, 204);
      }
      return jsonResponse(res, 405, errorResponse(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.', [], requestPath));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'INVALID_JSON') {
        return jsonResponse(res, 400, errorResponse(400, 'INVALID_JSON', 'Request body is not valid JSON.', [], requestPath));
      }
      return jsonResponse(res, 500, errorResponse(500, 'INTERNAL_ERROR', 'Internal server error.', [], requestPath));
    }
  }

  return createServer(handle);
}

export async function startMockApi(): Promise<{ baseUrl: string; stop(): Promise<void> }> {
  const server = createMockApi();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address() as AddressInfo;
  return {
    baseUrl: 'http://127.0.0.1:' + address.port,
    async stop(): Promise<void> {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
