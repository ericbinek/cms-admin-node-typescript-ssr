import test from 'node:test';
import assert from 'node:assert/strict';
import {
  startStack,
  loginAdmin,
  adminGet,
  adminPostForm,
  formBodyFor,
  SESSION_COOKIE,
} from './_helpers.ts';
import type { Stack } from './_helpers.ts';

const ENTITY = "BlogPosting";
const BASE = "/blog-postings";

let stack: Stack;
test.before(async () => {
  stack = await startStack();
});
test.after(async () => {
  await stack.stop();
});

test('unauthenticated dashboard redirects to login', async () => {
  const r = await adminGet(stack, '/');
  assert.equal(r.status, 303);
  assert.equal(r.headers.get('location'), '/login');
});

test('unauthenticated entity route redirects to login', async () => {
  const r = await adminGet(stack, BASE);
  assert.equal(r.status, 303);
  assert.equal(r.headers.get('location'), '/login');
});

test('GET /login renders a sign-in form', async () => {
  const r = await adminGet(stack, '/login');
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.match(html, /<form[^>]+method="POST"[^>]+action="\/login"/);
  assert.match(html, /type="password"/);
  assert.match(html, /name="_csrf"/);
});

test('login with wrong credentials returns 401 with an alert', async () => {
  const jar = {};
  await adminGet(stack, '/login', jar);
  const r = await adminPostForm(stack, '/login', 'username=admin&password=wrong', jar);
  assert.equal(r.status, 401);
  const html = await r.text();
  assert.match(html, /role="alert"/);
});

test('login sets an HttpOnly, SameSite=Strict session cookie and redirects to dashboard', async () => {
  const jar = {};
  await adminGet(stack, '/login', jar);
  const r = await adminPostForm(stack, '/login', 'username=admin&password=admin-password', jar);
  assert.equal(r.status, 303);
  assert.equal(r.headers.get('location'), '/');
  const setCookies = r.headers.getSetCookie().join('\n');
  assert.match(setCookies, new RegExp(SESSION_COOKIE + '='));
  assert.match(setCookies, /HttpOnly/i);
  assert.match(setCookies, /SameSite=Strict/i);
});

test('authenticated dashboard renders after login', async () => {
  const jar = await loginAdmin(stack);
  const r = await adminGet(stack, '/', jar);
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.match(html, /Dashboard/);
  assert.match(html, /Sign out/);
});

test('state-changing POST without a CSRF token is rejected with 403', async () => {
  const jar = await loginAdmin(stack);
  const body = await formBodyFor(stack, ENTITY, jar);
  const r = await adminPostForm(stack, BASE + '/new', body, jar, { withCsrf: false });
  assert.equal(r.status, 403);
});

test('state-changing POST with a wrong CSRF token is rejected with 403', async () => {
  const jar = await loginAdmin(stack);
  const body = await formBodyFor(stack, ENTITY, jar) + '&_csrf=not-the-real-token';
  const r = await adminPostForm(stack, BASE + '/new', body, jar, { withCsrf: false });
  assert.equal(r.status, 403);
});

test('logout clears the session and protected routes redirect to login again', async () => {
  const jar = await loginAdmin(stack);
  const out = await adminPostForm(stack, '/logout', '', jar);
  assert.equal(out.status, 303);
  assert.equal(out.headers.get('location'), '/login');
  const after = await adminGet(stack, '/', jar);
  assert.equal(after.status, 303);
  assert.equal(after.headers.get('location'), '/login');
});
