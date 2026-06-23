import { layout, escapeHtml, csrfField, renderField, parseFormBody, formValuesFromItem, displayName, errorPage } from '../layout.ts';
import type { Property, PageResult, SubmitResult, RefOption, User } from '../layout.ts';
import type { BoundApi } from '../../api-client.ts';

const ENTITY = "Organization";
const BASE = "/organizations";
const PROPERTIES: Property[] = [
  { name: "name", kind: 'InlineScalar', use: "Text", cardinality: "one", required: true, maxLength: 256 },
  { name: "legalName", kind: 'InlineScalar', use: "Text", cardinality: "one", required: false, maxLength: 256 },
  { name: "description", kind: 'InlineScalar', use: "Text", cardinality: "one", required: false, maxLength: 5000, multiline: true },
  { name: "url", kind: 'InlineScalar', use: "URL", cardinality: "one", required: false, maxLength: 2048 },
  { name: "email", kind: 'InlineScalar', use: "Text", cardinality: "one", required: false, maxLength: 320 },
  { name: "telephone", kind: 'InlineScalar', use: "Text", cardinality: "one", required: false, maxLength: 64 },
  { name: "logo", kind: 'Ref', targets: ["ImageObject"], cardinality: "one", required: false },
  { name: "foundingDate", kind: 'InlineScalar', use: "Date", cardinality: "one", required: false },
  { name: "sameAs", kind: 'InlineScalar', use: "URL", cardinality: "many", required: false, maxLength: 2048 },
  { name: "parentOrganization", kind: 'Ref', targets: ["Organization"], cardinality: "one", required: false },
];

async function loadRefOptions(api: BoundApi): Promise<Record<string, RefOption[]>> {
  const out: Record<string, RefOption[]> = {};
  for (const prop of PROPERTIES) {
    if (prop.kind !== 'Ref') continue;
    const collected: RefOption[] = [];
    for (const target of prop.targets) {
      const r = await api.list(target, { limit: 100 });
      if (r.status === 200 && r.body && Array.isArray(r.body.items)) {
        for (const item of r.body.items) {
          collected.push({ value: item.id, label: target + ': ' + displayName(item, target) });
        }
      }
    }
    out[prop.name] = collected;
  }
  return out;
}

function extractErrorList(body: any): string[] {
  if (!body) return ['Request failed.'];
  if (Array.isArray(body.details) && body.details.length) return body.details;
  if (typeof body.message === 'string') return [body.message];
  return ['Request failed.'];
}

export async function renderForm(
  { id, api, csrf, user, values, errors = [], fieldErrors = {} }:
  { id: string; api: BoundApi; csrf: string; user: User; values?: Record<string, unknown>; errors?: string[]; fieldErrors?: Record<string, string[]> },
): Promise<PageResult> {
  let initial: Record<string, unknown> | undefined = values;
  if (!initial) {
    const { status, body } = await api.get(ENTITY, id);
    if (status === 404) return errorPage(404, ENTITY + ' not found.', user);
    if (status !== 200) return errorPage(status, body?.message || 'Failed to load.', user);
    initial = formValuesFromItem(body, PROPERTIES);
  }
  const refOptions = await loadRefOptions(api);
  const fields = PROPERTIES.map((p) =>
    renderField({ prop: p, value: initial[p.name], refOptions, errors: fieldErrors[p.name] || [] })).join('\n');
  const errorBlock = errors.length
    ? `<div role="alert"><p>Could not save:</p><ul>${errors.map((e) => '<li>' + escapeHtml(e) + '</li>').join('')}</ul></div>`
    : '';
  return {
    status: errors.length ? 400 : 200,
    html: layout({
      title: 'Edit ' + ENTITY,
      currentEntity: ENTITY,
      user,
      csrf,
      body: `
${errorBlock}
<form method="POST" action="${BASE}/${escapeHtml(id)}/edit">
${csrfField(csrf)}
${fields}
<p><button type="submit">Save</button> · <a href="${BASE}/${escapeHtml(id)}">Cancel</a></p>
</form>`,
    }),
  };
}

export async function handleSubmit(
  { api, id, form, user }: { api: BoundApi; id: string; form: URLSearchParams; user: User },
): Promise<SubmitResult> {
  const payload = parseFormBody(form, PROPERTIES);
  const { status, body } = await api.update(ENTITY, id, payload);
  if (status === 200) {
    return { status: 303, redirect: BASE + '/' + id };
  }
  if (status === 404) return errorPage(404, ENTITY + ' not found.', user);
  return { status: 400, errors: extractErrorList(body), values: payload };
}
