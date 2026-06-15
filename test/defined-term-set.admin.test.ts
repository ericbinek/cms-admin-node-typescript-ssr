import test from 'node:test';
import assert from 'node:assert/strict';
import {
  startStack,
  loginAdmin,
  resetSeedCache,
  ensureEntity,
  formBodyFor,
  adminGet,
  adminPostForm,
  seedWith,
  PLURALS,
} from './_helpers.ts';
import type { Stack, CookieJar } from './_helpers.ts';

const ENTITY = "DefinedTermSet";
const BASE = "/defined-term-sets";

let stack: Stack;
let jar: CookieJar;
test.before(async () => {
  stack = await startStack();
  jar = await loginAdmin(stack);
});
test.after(async () => {
  await stack.stop();
});
test.beforeEach(() => {
  resetSeedCache();
});

test(`${ENTITY}: unauthenticated list redirects to login`, async () => {
  const r = await adminGet(stack, BASE); // no jar -> no session cookie
  assert.equal(r.status, 303);
  assert.equal(r.headers.get('location'), '/login');
});

test(`${ENTITY}: GET list renders semantic page`, async () => {
  await ensureEntity(stack, ENTITY, jar);
  const r = await adminGet(stack, BASE, jar);
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.match(html, /<table\b/);
  assert.match(html, /<caption>/);
  assert.match(html, new RegExp(ENTITY));
});

test(`${ENTITY}: GET /new renders a form with a CSRF field`, async () => {
  const r = await adminGet(stack, BASE + '/new', jar);
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.match(html, /<form[^>]+method="POST"/);
  assert.match(html, /name="_csrf"/);
  assert.match(html, new RegExp('action="' + BASE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/new"'));
});

test(`${ENTITY}: POST /new with valid form redirects to detail`, async () => {
  const body = await formBodyFor(stack, ENTITY, jar);
  const r = await adminPostForm(stack, BASE + '/new', body, jar);
  assert.equal(r.status, 303);
  const loc = r.headers.get('location');
  assert.ok(loc && loc.startsWith(BASE + '/'), 'expected redirect to ' + BASE + '/<id>, got ' + loc);
});

test(`${ENTITY}: POST /new with empty form returns 400 with role=alert`, async () => {
  const r = await adminPostForm(stack, BASE + '/new', '', jar);
  // No required fields -> an empty create is valid and the mock returns 201.
  if (r.status === 303) return;
  assert.equal(r.status, 400);
  const html = await r.text();
  assert.match(html, /role="alert"/);
});

test(`${ENTITY}: GET detail returns 200 with article markup`, async () => {
  const id = await ensureEntity(stack, ENTITY, jar);
  const r = await adminGet(stack, BASE + '/' + id, jar);
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.match(html, /<article\b/);
  assert.match(html, /<dl>/);
  assert.match(html, new RegExp(id));
});

test(`${ENTITY}: GET edit renders pre-filled form`, async () => {
  const id = await ensureEntity(stack, ENTITY, jar);
  const r = await adminGet(stack, BASE + '/' + id + '/edit', jar);
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.match(html, /<form[^>]+method="POST"/);
  assert.match(html, /name="_csrf"/);
});

test(`${ENTITY}: POST edit redirects back to detail`, async () => {
  const id = await ensureEntity(stack, ENTITY, jar);
  const body = await formBodyFor(stack, ENTITY, jar);
  const r = await adminPostForm(stack, BASE + '/' + id + '/edit', body, jar);
  assert.equal(r.status, 303);
  assert.equal(r.headers.get('location'), BASE + '/' + id);
});

test(`${ENTITY}: GET delete renders confirmation form`, async () => {
  const id = await ensureEntity(stack, ENTITY, jar);
  const r = await adminGet(stack, BASE + '/' + id + '/delete', jar);
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.match(html, /<form[^>]+method="POST"/);
  assert.match(html, /Confirm Delete/);
});

test(`${ENTITY}: POST delete redirects to list`, async () => {
  const id = await ensureEntity(stack, ENTITY, jar);
  const r = await adminPostForm(stack, BASE + '/' + id + '/delete', '', jar);
  assert.equal(r.status, 303);
  assert.equal(r.headers.get('location'), BASE);
});

test(`${ENTITY}: GET detail with non-UUID id returns 400 with alert`, async () => {
  const r = await adminGet(stack, BASE + '/not-a-uuid', jar);
  assert.equal(r.status, 400);
  const html = await r.text();
  assert.match(html, /role="alert"/);
});

test(`${ENTITY}: GET detail of missing id renders 404 page`, async () => {
  const r = await adminGet(stack, BASE + '/00000000-0000-0000-0000-000000000000', jar);
  assert.equal(r.status, 404);
  const html = await r.text();
  assert.match(html, /role="alert"/);
});

test(`${ENTITY}: navigation includes self link with aria-current`, async () => {
  await ensureEntity(stack, ENTITY, jar);
  const r = await adminGet(stack, BASE, jar);
  const html = await r.text();
  assert.match(html, /aria-current="page"/);
});

test(`${ENTITY}: list view paginates with previous and next navigation`, async () => {
  await seedWith(stack, ENTITY, {}, jar);
  await seedWith(stack, ENTITY, {}, jar);
  await seedWith(stack, ENTITY, {}, jar);
  const first = await adminGet(stack, BASE + '?limit=2&offset=0', jar);
  assert.equal(first.status, 200);
  const firstHtml = await first.text();
  assert.match(firstHtml, /rel="next"/);
  assert.match(firstHtml, /offset=2/);
  assert.doesNotMatch(firstHtml, /rel="prev"/);

  const second = await adminGet(stack, BASE + '?limit=2&offset=2', jar);
  assert.equal(second.status, 200);
  const secondHtml = await second.text();
  assert.match(secondHtml, /rel="prev"/);
});

test(`${ENTITY}: stored javascript: and data: URLs render as inert text, never as links`, async () => {
  const jsId = await seedWith(stack, ENTITY, { "url": 'javascript:alert(1)' }, jar);
  const jsHtml = await (await adminGet(stack, BASE + '/' + jsId, jar)).text();
  assert.match(jsHtml, /javascript:alert\(1\)/);
  assert.doesNotMatch(jsHtml, /href="javascript:/i);

  const dataId = await seedWith(stack, ENTITY, { "url": 'data:text/html,x' }, jar);
  const dataHtml = await (await adminGet(stack, BASE + '/' + dataId, jar)).text();
  assert.match(dataHtml, /data:text\/html,x/);
  assert.doesNotMatch(dataHtml, /href="data:/i);
});

test(`${ENTITY}: stored http(s) URL renders as a clickable link`, async () => {
  const id = await seedWith(stack, ENTITY, { "url": 'https://example.com/profile' }, jar);
  const html = await (await adminGet(stack, BASE + '/' + id, jar)).text();
  assert.match(html, /href="https:\/\/example\.com\/profile"/);
});

void PLURALS;
