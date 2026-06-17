import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { layout, escapeHtml } from './views/layout.ts';
import type { PageResult, SubmitResult, User } from './views/layout.ts';
import { renderLogin } from './views/login.ts';
import { apiFor, login, logout, me, SessionExpiredError } from './api-client.ts';
import type { BoundApi } from './api-client.ts';
import {
  parseCookies,
  SESSION_COOKIE,
  CSRF_COOKIE,
  randomToken,
  csrfValid,
  setSessionCookie,
  clearSessionCookie,
  setCsrfCookie,
} from './auth.ts';
import * as BlogPostingList from './views/blog-posting/list.ts';
import * as BlogPostingDetail from './views/blog-posting/detail.ts';
import * as BlogPostingCreate from './views/blog-posting/create.ts';
import * as BlogPostingEdit from './views/blog-posting/edit.ts';
import * as BlogPostingDelete from './views/blog-posting/delete.ts';
import * as PersonList from './views/person/list.ts';
import * as PersonDetail from './views/person/detail.ts';
import * as PersonCreate from './views/person/create.ts';
import * as PersonEdit from './views/person/edit.ts';
import * as PersonDelete from './views/person/delete.ts';
import * as OrganizationList from './views/organization/list.ts';
import * as OrganizationDetail from './views/organization/detail.ts';
import * as OrganizationCreate from './views/organization/create.ts';
import * as OrganizationEdit from './views/organization/edit.ts';
import * as OrganizationDelete from './views/organization/delete.ts';
import * as WebPageList from './views/web-page/list.ts';
import * as WebPageDetail from './views/web-page/detail.ts';
import * as WebPageCreate from './views/web-page/create.ts';
import * as WebPageEdit from './views/web-page/edit.ts';
import * as WebPageDelete from './views/web-page/delete.ts';
import * as ImageObjectList from './views/image-object/list.ts';
import * as ImageObjectDetail from './views/image-object/detail.ts';
import * as ImageObjectCreate from './views/image-object/create.ts';
import * as ImageObjectEdit from './views/image-object/edit.ts';
import * as ImageObjectDelete from './views/image-object/delete.ts';
import * as VideoObjectList from './views/video-object/list.ts';
import * as VideoObjectDetail from './views/video-object/detail.ts';
import * as VideoObjectCreate from './views/video-object/create.ts';
import * as VideoObjectEdit from './views/video-object/edit.ts';
import * as VideoObjectDelete from './views/video-object/delete.ts';
import * as AudioObjectList from './views/audio-object/list.ts';
import * as AudioObjectDetail from './views/audio-object/detail.ts';
import * as AudioObjectCreate from './views/audio-object/create.ts';
import * as AudioObjectEdit from './views/audio-object/edit.ts';
import * as AudioObjectDelete from './views/audio-object/delete.ts';
import * as CategoryCodeList from './views/category-code/list.ts';
import * as CategoryCodeDetail from './views/category-code/detail.ts';
import * as CategoryCodeCreate from './views/category-code/create.ts';
import * as CategoryCodeEdit from './views/category-code/edit.ts';
import * as CategoryCodeDelete from './views/category-code/delete.ts';
import * as CategoryCodeSetList from './views/category-code-set/list.ts';
import * as CategoryCodeSetDetail from './views/category-code-set/detail.ts';
import * as CategoryCodeSetCreate from './views/category-code-set/create.ts';
import * as CategoryCodeSetEdit from './views/category-code-set/edit.ts';
import * as CategoryCodeSetDelete from './views/category-code-set/delete.ts';
import * as DefinedTermList from './views/defined-term/list.ts';
import * as DefinedTermDetail from './views/defined-term/detail.ts';
import * as DefinedTermCreate from './views/defined-term/create.ts';
import * as DefinedTermEdit from './views/defined-term/edit.ts';
import * as DefinedTermDelete from './views/defined-term/delete.ts';
import * as DefinedTermSetList from './views/defined-term-set/list.ts';
import * as DefinedTermSetDetail from './views/defined-term-set/detail.ts';
import * as DefinedTermSetCreate from './views/defined-term-set/create.ts';
import * as DefinedTermSetEdit from './views/defined-term-set/edit.ts';
import * as DefinedTermSetDelete from './views/defined-term-set/delete.ts';
import * as CommentList from './views/comment/list.ts';
import * as CommentDetail from './views/comment/detail.ts';
import * as CommentCreate from './views/comment/create.ts';
import * as CommentEdit from './views/comment/edit.ts';
import * as CommentDelete from './views/comment/delete.ts';
import * as WebSiteList from './views/web-site/list.ts';
import * as WebSiteDetail from './views/web-site/detail.ts';
import * as WebSiteCreate from './views/web-site/create.ts';
import * as WebSiteEdit from './views/web-site/edit.ts';
import * as WebSiteDelete from './views/web-site/delete.ts';
import * as SiteNavigationElementList from './views/site-navigation-element/list.ts';
import * as SiteNavigationElementDetail from './views/site-navigation-element/detail.ts';
import * as SiteNavigationElementCreate from './views/site-navigation-element/create.ts';
import * as SiteNavigationElementEdit from './views/site-navigation-element/edit.ts';
import * as SiteNavigationElementDelete from './views/site-navigation-element/delete.ts';

interface ViewCtx {
  api: BoundApi;
  csrf: string;
  user: User;
}
interface ListView {
  render(opts: { url: URL } & ViewCtx): Promise<PageResult>;
}
interface DetailView {
  render(opts: { id: string } & ViewCtx): Promise<PageResult>;
}
interface CreateView {
  renderForm(opts: { values?: Record<string, unknown>; errors?: string[]; fieldErrors?: Record<string, string[]> } & ViewCtx): Promise<PageResult>;
  handleSubmit(opts: { form: URLSearchParams } & ViewCtx): Promise<SubmitResult>;
}
interface EditView {
  renderForm(opts: { id: string; values?: Record<string, unknown>; errors?: string[]; fieldErrors?: Record<string, string[]> } & ViewCtx): Promise<PageResult>;
  handleSubmit(opts: { id: string; form: URLSearchParams } & ViewCtx): Promise<SubmitResult>;
}
interface DeleteView {
  renderForm(opts: { id: string } & ViewCtx): Promise<PageResult>;
  handleSubmit(opts: { id: string } & ViewCtx): Promise<SubmitResult>;
}
interface EntityRoute {
  entity: string;
  plural: string;
  views: { list: ListView; detail: DetailView; create: CreateView; edit: EditView; del: DeleteView };
}
interface RouteMatch {
  route: EntityRoute;
  kind: string;
  id?: string;
}

const PORT = parseInt(process.env.PORT || '5008', 10);
const HOST = process.env.HOST || '0.0.0.0';
const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = resolve(__dirname, '..', 'public');
const MAX_BODY_SIZE = 1024 * 1024;

const ENTITY_ROUTES: EntityRoute[] = [
  { entity: "BlogPosting", plural: "blog-postings",
    views: { list: BlogPostingList, detail: BlogPostingDetail, create: BlogPostingCreate, edit: BlogPostingEdit, del: BlogPostingDelete } },
  { entity: "Person", plural: "persons",
    views: { list: PersonList, detail: PersonDetail, create: PersonCreate, edit: PersonEdit, del: PersonDelete } },
  { entity: "Organization", plural: "organizations",
    views: { list: OrganizationList, detail: OrganizationDetail, create: OrganizationCreate, edit: OrganizationEdit, del: OrganizationDelete } },
  { entity: "WebPage", plural: "web-pages",
    views: { list: WebPageList, detail: WebPageDetail, create: WebPageCreate, edit: WebPageEdit, del: WebPageDelete } },
  { entity: "ImageObject", plural: "image-objects",
    views: { list: ImageObjectList, detail: ImageObjectDetail, create: ImageObjectCreate, edit: ImageObjectEdit, del: ImageObjectDelete } },
  { entity: "VideoObject", plural: "video-objects",
    views: { list: VideoObjectList, detail: VideoObjectDetail, create: VideoObjectCreate, edit: VideoObjectEdit, del: VideoObjectDelete } },
  { entity: "AudioObject", plural: "audio-objects",
    views: { list: AudioObjectList, detail: AudioObjectDetail, create: AudioObjectCreate, edit: AudioObjectEdit, del: AudioObjectDelete } },
  { entity: "CategoryCode", plural: "category-codes",
    views: { list: CategoryCodeList, detail: CategoryCodeDetail, create: CategoryCodeCreate, edit: CategoryCodeEdit, del: CategoryCodeDelete } },
  { entity: "CategoryCodeSet", plural: "category-code-sets",
    views: { list: CategoryCodeSetList, detail: CategoryCodeSetDetail, create: CategoryCodeSetCreate, edit: CategoryCodeSetEdit, del: CategoryCodeSetDelete } },
  { entity: "DefinedTerm", plural: "defined-terms",
    views: { list: DefinedTermList, detail: DefinedTermDetail, create: DefinedTermCreate, edit: DefinedTermEdit, del: DefinedTermDelete } },
  { entity: "DefinedTermSet", plural: "defined-term-sets",
    views: { list: DefinedTermSetList, detail: DefinedTermSetDetail, create: DefinedTermSetCreate, edit: DefinedTermSetEdit, del: DefinedTermSetDelete } },
  { entity: "Comment", plural: "comments",
    views: { list: CommentList, detail: CommentDetail, create: CommentCreate, edit: CommentEdit, del: CommentDelete } },
  { entity: "WebSite", plural: "web-sites",
    views: { list: WebSiteList, detail: WebSiteDetail, create: WebSiteCreate, edit: WebSiteEdit, del: WebSiteDelete } },
  { entity: "SiteNavigationElement", plural: "site-navigation-elements",
    views: { list: SiteNavigationElementList, detail: SiteNavigationElementDetail, create: SiteNavigationElementCreate, edit: SiteNavigationElementEdit, del: SiteNavigationElementDelete } },
];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function indexPage(user: User, csrf: string): PageResult {
  const items = ENTITY_ROUTES.map((r) =>
    `<li><a href="/${r.plural}">${escapeHtml(r.entity)}</a></li>`).join('');
  return {
    status: 200,
    html: layout({
      title: 'Dashboard',
      user,
      csrf,
      body: `<p>Manage content for ${ENTITY_ROUTES.length} entity types.</p><ul>${items}</ul>`,
    }),
  };
}

function sendHtml(res: ServerResponse, page: { status?: number; html: string }, { setCookies = [] }: { setCookies?: string[] } = {}): void {
  const status = page.status ?? 200;
  const html = page.html;
  const headers: Record<string, string | string[]> = {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': String(Buffer.byteLength(html)),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
  };
  if (setCookies.length) headers['Set-Cookie'] = setCookies;
  res.writeHead(status, headers);
  res.end(html);
}

function sendRedirect(res: ServerResponse, location: string, status = 303, { setCookies = [] }: { setCookies?: string[] } = {}): void {
  const headers: Record<string, string | string[]> = { Location: location };
  if (setCookies.length) headers['Set-Cookie'] = setCookies;
  res.writeHead(status, headers);
  res.end();
}

function notFoundResponse(user?: User | null, csrf?: string): PageResult {
  return {
    status: 404,
    html: layout({ title: 'Not Found', user, csrf, body: '<p role="alert">Page not found.</p>' }),
  };
}

function invalidIdResponse(user: User, csrf: string): PageResult {
  return {
    status: 400,
    html: layout({ title: 'Invalid ID', user, csrf, body: '<p role="alert">ID must be a valid UUID.</p>' }),
  };
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  let oversized = false;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_SIZE) {
      oversized = true;
      continue;
    }
    chunks.push(chunk);
  }
  if (oversized) {
    const err: NodeJS.ErrnoException = new Error('Request body too large.');
    err.code = 'PAYLOAD_TOO_LARGE';
    throw err;
  }
  return Buffer.concat(chunks).toString('utf-8');
}

async function parseFormFromRequest(req: IncomingMessage): Promise<URLSearchParams | null> {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.startsWith('application/x-www-form-urlencoded')) {
    return null;
  }
  const raw = await readBody(req);
  return new URLSearchParams(raw);
}

async function serveStatic(res: ServerResponse, relPath: string, contentType: string): Promise<void> {
  try {
    const full = resolve(PUBLIC_DIR, relPath);
    if (!full.startsWith(PUBLIC_DIR)) {
      sendHtml(res, notFoundResponse());
      return;
    }
    const content = await readFile(full);
    res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=300' });
    res.end(content);
  } catch {
    sendHtml(res, notFoundResponse());
  }
}

function matchEntityRoute(pathname: string): RouteMatch | null {
  for (const r of ENTITY_ROUTES) {
    const base = '/' + r.plural;
    if (pathname === base) return { route: r, kind: 'list' };
    if (pathname === base + '/new') return { route: r, kind: 'new' };
    const m = pathname.match(new RegExp('^' + base.replace(/[/\\\-]/g, (c) => '\\' + c) + '/([^/]+)(?:/(edit|delete))?$'));
    if (m) {
      return { route: r, kind: m[2] || 'detail', id: m[1] };
    }
  }
  return null;
}

// Resolves and validates the session by asking the API who we are. A 401 means
// the session is gone — surfaced as SessionExpiredError so the caller redirects
// to login. Doubles as the per-request principal lookup for the layout header.
async function requireUser(token: string): Promise<User> {
  const { status, body } = await me(token);
  if (status === 401 || !body || !body.account) throw new SessionExpiredError();
  return body.account as User;
}

async function handleGet(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  pathname: string,
  sessionToken: string | null,
  csrf: string,
  setCookies: string[],
): Promise<void> {
  if (pathname === '/login') {
    // Already carrying a session: go to the dashboard. A stale cookie bounces
    // back here (cleared) on the first failing API call.
    if (sessionToken) { sendRedirect(res, '/', 303, { setCookies }); return; }
    sendHtml(res, renderLogin({ csrf }), { setCookies });
    return;
  }

  if (!sessionToken) { sendRedirect(res, '/login', 303, { setCookies }); return; }
  const user = await requireUser(sessionToken);
  const api = apiFor(sessionToken);

  if (pathname === '/') { sendHtml(res, indexPage(user, csrf), { setCookies }); return; }

  const match = matchEntityRoute(pathname);
  if (!match) { sendHtml(res, notFoundResponse(user, csrf), { setCookies }); return; }
  const { route, kind, id } = match;
  const idValid = !id || UUID_PATTERN.test(id);
  const ctx: ViewCtx = { api, csrf, user };

  if (kind === 'list') { sendHtml(res, await route.views.list.render({ url, ...ctx }), { setCookies }); return; }
  if (kind === 'new') { sendHtml(res, await route.views.create.renderForm({ ...ctx }), { setCookies }); return; }
  if (kind === 'detail') {
    if (!idValid) { sendHtml(res, invalidIdResponse(user, csrf), { setCookies }); return; }
    sendHtml(res, await route.views.detail.render({ id: id!, ...ctx }), { setCookies });
    return;
  }
  if (kind === 'edit') {
    if (!idValid) { sendHtml(res, invalidIdResponse(user, csrf), { setCookies }); return; }
    sendHtml(res, await route.views.edit.renderForm({ id: id!, ...ctx }), { setCookies });
    return;
  }
  if (kind === 'delete') {
    if (!idValid) { sendHtml(res, invalidIdResponse(user, csrf), { setCookies }); return; }
    sendHtml(res, await route.views.del.renderForm({ id: id!, ...ctx }), { setCookies });
    return;
  }
  sendHtml(res, notFoundResponse(user, csrf), { setCookies });
}

async function handlePost(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  pathname: string,
  form: URLSearchParams,
  sessionToken: string | null,
  csrf: string,
  setCookies: string[],
): Promise<void> {
  if (pathname === '/login') {
    const username = (form.get('username') || '').trim();
    const password = form.get('password') || '';
    if (!username || !password) {
      sendHtml(res, renderLogin({ csrf, error: 'Username and password are required.', username }), { setCookies });
      return;
    }
    const { status, body } = await login(username, password);
    if (status === 200 && body && body.token) {
      sendRedirect(res, '/', 303, { setCookies: [...setCookies, setSessionCookie(body.token)] });
      return;
    }
    sendHtml(res, renderLogin({ csrf, error: 'Invalid username or password.', username }), { setCookies });
    return;
  }

  if (pathname === '/logout') {
    if (sessionToken) { try { await logout(sessionToken); } catch { /* best effort, cookie is cleared anyway */ } }
    sendRedirect(res, '/login', 303, { setCookies: [...setCookies, clearSessionCookie()] });
    return;
  }

  if (!sessionToken) { sendRedirect(res, '/login', 303, { setCookies }); return; }
  const user = await requireUser(sessionToken);
  const api = apiFor(sessionToken);

  const match = matchEntityRoute(pathname);
  if (!match) { sendHtml(res, notFoundResponse(user, csrf), { setCookies }); return; }
  const { route, kind, id } = match;
  const idValid = !id || UUID_PATTERN.test(id);
  const ctx: ViewCtx = { api, csrf, user };

  if (kind === 'new') {
    const result = await route.views.create.handleSubmit({ ...ctx, form });
    if (result.redirect) { sendRedirect(res, result.redirect, result.status || 303, { setCookies }); return; }
    sendHtml(res, await route.views.create.renderForm({ ...ctx, errors: result.errors || [], fieldErrors: result.fieldErrors, values: result.values }), { setCookies });
    return;
  }
  if (kind === 'edit') {
    if (!idValid) { sendHtml(res, invalidIdResponse(user, csrf), { setCookies }); return; }
    const result = await route.views.edit.handleSubmit({ ...ctx, id: id!, form });
    if (result.redirect) { sendRedirect(res, result.redirect, result.status || 303, { setCookies }); return; }
    if (result.html) { sendHtml(res, result as PageResult, { setCookies }); return; }
    sendHtml(res, await route.views.edit.renderForm({ ...ctx, id: id!, errors: result.errors || [], fieldErrors: result.fieldErrors, values: result.values }), { setCookies });
    return;
  }
  if (kind === 'delete') {
    if (!idValid) { sendHtml(res, invalidIdResponse(user, csrf), { setCookies }); return; }
    const result = await route.views.del.handleSubmit({ ...ctx, id: id! });
    if (result.redirect) { sendRedirect(res, result.redirect, result.status || 303, { setCookies }); return; }
    sendHtml(res, result as PageResult, { setCookies });
    return;
  }
  sendHtml(res, notFoundResponse(user, csrf), { setCookies });
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const start = Date.now();
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const { pathname } = url;
  const method = req.method ?? '';
  res.on('finish', () => {
    console.log(`${method} ${pathname} ${res.statusCode} ${Date.now() - start}ms`);
  });

  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies[SESSION_COOKIE] || null;
  // Issue a CSRF token if the browser has none yet; never rotate an existing one
  // (it would invalidate a form open in another tab).
  let csrf = cookies[CSRF_COOKIE];
  const setCookies: string[] = [];
  if (!csrf) {
    csrf = randomToken();
    setCookies.push(setCsrfCookie(csrf));
  }

  try {
    if (method === 'GET' && pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"status":"ok"}');
      return;
    }
    if (method === 'GET' && pathname === '/style.css') {
      await serveStatic(res, 'style.css', 'text/css; charset=utf-8');
      return;
    }

    if (method === 'POST') {
      const form = await parseFormFromRequest(req);
      if (!form) {
        sendHtml(res, { status: 415, html: layout({ title: 'Unsupported', body: '<p role="alert">Form encoding required.</p>' }) }, { setCookies });
        return;
      }
      // CSRF: the submitted token must match the cookie set on a prior GET.
      if (!csrfValid(cookies[CSRF_COOKIE], form.get('_csrf'))) {
        sendHtml(res, { status: 403, html: layout({ title: 'Forbidden', body: '<p role="alert">Invalid or missing CSRF token. Reload the form and try again.</p>' }) }, { setCookies });
        return;
      }
      await handlePost(req, res, url, pathname, form, sessionToken, csrf, setCookies);
      return;
    }

    if (method === 'GET') {
      await handleGet(req, res, url, pathname, sessionToken, csrf, setCookies);
      return;
    }

    sendHtml(res, notFoundResponse(), { setCookies });
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      sendRedirect(res, '/login', 303, { setCookies: [...setCookies, clearSessionCookie()] });
      return;
    }
    if ((error as NodeJS.ErrnoException).code === 'PAYLOAD_TOO_LARGE') {
      sendHtml(res, { status: 413, html: layout({ title: 'Too Large', body: '<p role="alert">Request body too large.</p>' }) }, { setCookies });
      return;
    }
    console.error(`[${method} ${pathname}] ${error instanceof Error ? error.message : String(error)}`);
    sendHtml(res, { status: 500, html: layout({ title: 'Error', body: '<p role="alert">Internal server error.</p>' }) }, { setCookies });
  }
}

const server = createServer(handleRequest);
server.listen(PORT, HOST, () => {
  console.log(`CMS admin running at http://${HOST}:${PORT}`);
});

function shutdown(signal: string): void {
  console.log(`${signal} received. Shutting down...`);
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
