import { spawn } from 'node:child_process';
import { createServer, type AddressInfo } from 'node:net';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startMockApi, ADMIN_USERNAME, ADMIN_PASSWORD } from './_mock-api.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

// Cookie names the admin server sets — kept in sync with src/auth.ts.
export const SESSION_COOKIE = 'cms_session';
export const CSRF_COOKIE = 'cms_csrf';

export const PLURALS: Record<string, string> = {
  "BlogPosting": "blog-postings",
  "Person": "persons",
  "Organization": "organizations",
  "WebPage": "web-pages",
  "ImageObject": "image-objects",
  "VideoObject": "video-objects",
  "AudioObject": "audio-objects",
  "CategoryCode": "category-codes",
  "CategoryCodeSet": "category-code-sets",
  "DefinedTerm": "defined-terms",
  "DefinedTermSet": "defined-term-sets",
  "Comment": "comments",
  "WebSite": "web-sites",
  "SiteNavigationElement": "site-navigation-elements"
};
export const SAMPLES: Record<string, Record<string, unknown>> = {
  "BlogPosting": {
    "headline": "sample",
    "articleBody": "sample",
    "author": {
      "__ref": "Person"
    },
    "url": "https://example.com/x"
  },
  "Person": {
    "name": "sample"
  },
  "Organization": {
    "name": "sample"
  },
  "WebPage": {
    "headline": "sample"
  },
  "ImageObject": {
    "contentUrl": "https://example.com/x"
  },
  "VideoObject": {
    "contentUrl": "https://example.com/x"
  },
  "AudioObject": {
    "contentUrl": "https://example.com/x"
  },
  "CategoryCode": {
    "name": "sample",
    "codeValue": "sample",
    "inCodeSet": {
      "__ref": "CategoryCodeSet"
    }
  },
  "CategoryCodeSet": {
    "name": "sample"
  },
  "DefinedTerm": {
    "name": "sample",
    "termCode": "sample",
    "inDefinedTermSet": {
      "__ref": "DefinedTermSet"
    }
  },
  "DefinedTermSet": {
    "name": "sample"
  },
  "Comment": {
    "text": "sample",
    "author": {
      "__ref": "Person"
    },
    "about": {
      "__ref": "BlogPosting"
    }
  },
  "WebSite": {
    "name": "sample",
    "url": "https://example.com/x"
  },
  "SiteNavigationElement": {
    "name": "sample",
    "url": "https://example.com/x"
  }
};
export const ENTITIES: string[] = ["BlogPosting","Person","Organization","WebPage","ImageObject","VideoObject","AudioObject","CategoryCode","CategoryCodeSet","DefinedTerm","DefinedTermSet","Comment","WebSite","SiteNavigationElement"];

export type CookieJar = Record<string, string>;

export interface Stack {
  apiBaseUrl: string;
  adminBaseUrl: string;
  stop(): Promise<void>;
}

// Ask the OS for a free port instead of guessing one. Test files run in
// parallel; a guessed port from a fixed range collides under load (EADDRINUSE).
function freePort(): Promise<number> {
  return new Promise((res, rej) => {
    const probe = createServer();
    probe.once('error', rej);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as AddressInfo;
      probe.close(() => res(port));
    });
  });
}

export async function startAdmin({ apiBaseUrl }: { apiBaseUrl: string }): Promise<{ baseUrl: string; stop(): Promise<void> }> {
  const port = await freePort();
  const child = spawn(process.execPath, ['src/server.ts'], {
    cwd: REPO_ROOT,
    env: { ...process.env, PORT: String(port), API_BASE_URL: apiBaseUrl },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr?.on('data', () => {});
  const baseUrl = 'http://127.0.0.1:' + port;
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(baseUrl + '/health');
      if (r.ok) {
        return {
          baseUrl,
          async stop(): Promise<void> {
            child.kill('SIGTERM');
            await new Promise<void>((res) => child.on('exit', () => res()));
          },
        };
      }
    } catch { /* retry */ }
    await new Promise((res) => setTimeout(res, 50));
  }
  child.kill('SIGTERM');
  throw new Error('Admin server did not start within 5 seconds');
}

export async function startStack(): Promise<Stack> {
  const mock = await startMockApi();
  const admin = await startAdmin({ apiBaseUrl: mock.baseUrl });
  return {
    apiBaseUrl: mock.baseUrl,
    adminBaseUrl: admin.baseUrl,
    async stop(): Promise<void> {
      await admin.stop();
      await mock.stop();
    },
  };
}

// --- Cookie jar (a plain name -> value map) -------------------------------

function applySetCookies(jar: CookieJar, res: Response): void {
  for (const sc of res.headers.getSetCookie()) {
    const pair = sc.split(';')[0];
    const idx = pair.indexOf('=');
    if (idx < 0) continue;
    const name = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (value === '') delete jar[name]; // Max-Age=0 clears with an empty value
    else jar[name] = value;
  }
}

function cookieHeader(jar: CookieJar): string {
  return Object.entries(jar).map(([k, v]) => k + '=' + v).join('; ');
}

export function apiToken(jar: CookieJar): string {
  return jar[SESSION_COOKIE];
}

export async function adminGet(stack: Stack, path: string, jar?: CookieJar): Promise<Response> {
  const res = await fetch(stack.adminBaseUrl + path, {
    headers: jar ? { Cookie: cookieHeader(jar) } : {},
    redirect: 'manual',
  });
  if (jar) applySetCookies(jar, res);
  return res;
}

export async function adminPostForm(
  stack: Stack,
  path: string,
  body: string,
  jar?: CookieJar,
  { withCsrf = true }: { withCsrf?: boolean } = {},
): Promise<Response> {
  let finalBody = body || '';
  if (withCsrf && jar && jar[CSRF_COOKIE] && !new URLSearchParams(finalBody).has('_csrf')) {
    finalBody = (finalBody ? finalBody + '&' : '') + '_csrf=' + encodeURIComponent(jar[CSRF_COOKIE]);
  }
  const res = await fetch(stack.adminBaseUrl + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(jar ? { Cookie: cookieHeader(jar) } : {}) },
    body: finalBody,
    redirect: 'manual',
  });
  if (jar) applySetCookies(jar, res);
  return res;
}

// Full browser-like login: GET /login to obtain the csrf cookie, then POST the
// credentials. Returns a cookie jar carrying the session and csrf cookies.
export async function loginAdmin(stack: Stack): Promise<CookieJar> {
  const jar: CookieJar = {};
  await adminGet(stack, '/login', jar);
  const res = await adminPostForm(
    stack, '/login',
    'username=' + encodeURIComponent(ADMIN_USERNAME) + '&password=' + encodeURIComponent(ADMIN_PASSWORD),
    jar,
  );
  if (res.status !== 303) {
    throw new Error('loginAdmin failed: expected 303, got ' + res.status);
  }
  return jar;
}

// --- Seeding goes straight to the mock API with the admin bearer token -----

function encodeOne(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (obj.__ref) return '__needs_resolve__';
    if (obj['@type'] === 'Language') return String(obj.alternateName || '');
    return JSON.stringify(value);
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

async function resolveRefs(stack: Stack, jar: CookieJar, sample: Record<string, unknown>): Promise<Record<string, unknown>> {
  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(sample)) {
    if (Array.isArray(value)) {
      const out: unknown[] = [];
      for (const v of value) {
        if (v && typeof v === 'object' && (v as { __ref?: string }).__ref) {
          out.push(await ensureEntity(stack, (v as { __ref: string }).__ref, jar));
        } else {
          out.push(v);
        }
      }
      resolved[key] = out;
    } else if (value && typeof value === 'object' && (value as { __ref?: string }).__ref) {
      resolved[key] = await ensureEntity(stack, (value as { __ref: string }).__ref, jar);
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
}

const seededIds = new Map<string, string>();

async function seedToMock(stack: Stack, jar: CookieJar, entityName: string, payload: Record<string, unknown>): Promise<string> {
  const r = await fetch(stack.apiBaseUrl + '/' + PLURALS[entityName], {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiToken(jar) },
    body: JSON.stringify(payload),
  });
  if (r.status !== 201) {
    const text = await r.text();
    throw new Error('seed(' + entityName + ') failed: ' + r.status + ' ' + text);
  }
  const item: any = await r.json();
  return item.id;
}

export async function ensureEntity(stack: Stack, entityName: string, jar: CookieJar): Promise<string> {
  const cached = seededIds.get(entityName);
  if (cached !== undefined) return cached;
  const sample = await resolveRefs(stack, jar, SAMPLES[entityName]);
  const id = await seedToMock(stack, jar, entityName, sample);
  seededIds.set(entityName, id);
  return id;
}

export function resetSeedCache(): void {
  seededIds.clear();
}

export async function seedWith(stack: Stack, entityName: string, overrides: Record<string, unknown>, jar: CookieJar): Promise<string> {
  const sample = await resolveRefs(stack, jar, SAMPLES[entityName]);
  return seedToMock(stack, jar, entityName, { ...sample, ...overrides });
}

export async function formBodyFor(stack: Stack, entityName: string, jar: CookieJar): Promise<string> {
  const sample = await resolveRefs(stack, jar, SAMPLES[entityName]);
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(sample)) {
    if (Array.isArray(value)) {
      for (const v of value) sp.append(key, encodeOne(v));
    } else {
      sp.append(key, encodeOne(value));
    }
  }
  return sp.toString();
}
