import { layout, escapeHtml, csrfField, renderField, parseFormBody, displayName } from '../layout.ts';
import type { Property, PageResult, SubmitResult, RefOption, User } from '../layout.ts';
import type { BoundApi } from '../../api-client.ts';

const ENTITY = "CategoryCodeSet";
const BASE = "/category-code-sets";
const PROPERTIES: Property[] = [
  { name: "name", kind: 'InlineScalar', use: "Text", cardinality: "one", required: true },
  { name: "description", kind: 'InlineScalar', use: "Text", cardinality: "one", required: false },
  { name: "url", kind: 'InlineScalar', use: "URL", cardinality: "one", required: false },
];

async function loadRefOptions(api: BoundApi): Promise<Record<string, RefOption[]>> { void api; return {}; }

function extractErrorList(body: any): string[] {
  if (!body) return ['Request failed.'];
  if (Array.isArray(body.details) && body.details.length) return body.details;
  if (typeof body.message === 'string') return [body.message];
  return ['Request failed.'];
}

export async function renderForm(
  { api, csrf, user, values = {}, errors = [], fieldErrors = {} }:
  { api: BoundApi; csrf: string; user: User; values?: Record<string, unknown>; errors?: string[]; fieldErrors?: Record<string, string[]> },
): Promise<PageResult> {
  const refOptions = await loadRefOptions(api);
  const fields = PROPERTIES.map((p) =>
    renderField({ prop: p, value: values[p.name], refOptions, errors: fieldErrors[p.name] || [] })).join('\n');
  const errorBlock = errors.length
    ? `<div role="alert"><p>Could not save:</p><ul>${errors.map((e) => '<li>' + escapeHtml(e) + '</li>').join('')}</ul></div>`
    : '';
  return {
    status: errors.length ? 400 : 200,
    html: layout({
      title: 'New ' + ENTITY,
      currentEntity: ENTITY,
      user,
      csrf,
      body: `
${errorBlock}
<form method="POST" action="${BASE}/new">
${csrfField(csrf)}
${fields}
<p><button type="submit">Create</button> · <a href="${BASE}">Cancel</a></p>
</form>`,
    }),
  };
}

export async function handleSubmit(
  { api, form }: { api: BoundApi; form: URLSearchParams },
): Promise<SubmitResult> {
  const payload = parseFormBody(form, PROPERTIES);
  const { status, body } = await api.create(ENTITY, payload);
  if (status === 201 && body && body.id) {
    return { status: 303, redirect: BASE + '/' + body.id };
  }
  return { status: 400, errors: extractErrorList(body), values: payload };
}
