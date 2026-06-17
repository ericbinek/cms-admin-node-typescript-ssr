// Shared layout, escaping, formatting, and field-rendering helpers.
// Imported by every view module. Has no runtime dependencies on the API
// — the views call the api-client themselves and pass values in.

export type Cardinality = 'one' | 'many';

export type Property =
  | { name: string; kind: 'InlineScalar'; use: string; cardinality: Cardinality; required: boolean }
  | { name: string; kind: 'Enum'; values: readonly string[]; cardinality: Cardinality; required: boolean }
  | { name: string; kind: 'Ref'; targets: readonly string[]; cardinality: Cardinality; required: boolean }
  | { name: string; kind: 'Embed'; use: string; cardinality: Cardinality; required: boolean };

export interface RefOption {
  value: string;
  label: string;
}

export interface User {
  id: string;
  username: string;
  role: string;
}

export interface PageResult {
  status: number;
  html: string;
}

export interface LayoutOptions {
  title: string;
  body: string;
  currentEntity?: string;
  user?: User | null;
  csrf?: string;
  flash?: string;
}

export interface SubmitResult {
  status?: number;
  redirect?: string;
  html?: string;
  errors?: string[];
  fieldErrors?: Record<string, string[]>;
  values?: Record<string, unknown>;
}

const ENTITIES: string[] = ["BlogPosting","Person","Organization","WebPage","ImageObject","VideoObject","AudioObject","CategoryCode","CategoryCodeSet","DefinedTerm","DefinedTermSet","Comment","WebSite","SiteNavigationElement"];
const PLURALS: Record<string, string> = {
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
  "SiteNavigationElement": "site-navigation-elements",
};
const DISPLAY_KEYS: Record<string, string[]> = {
  "BlogPosting": ["headline","alternativeHeadline"],
  "Person": ["name","givenName","familyName"],
  "Organization": ["name","legalName"],
  "WebPage": ["headline"],
  "ImageObject": ["name","caption","contentUrl"],
  "VideoObject": ["name","caption","contentUrl"],
  "AudioObject": ["name","contentUrl"],
  "CategoryCode": ["name","codeValue"],
  "CategoryCodeSet": ["name"],
  "DefinedTerm": ["name","termCode"],
  "DefinedTermSet": ["name"],
  "Comment": ["text"],
  "WebSite": ["name"],
  "SiteNavigationElement": ["name"],
};

export function pluralOf(entity: string): string {
  return PLURALS[entity];
}

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function escapeHtml(s: unknown): string {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

// The hidden CSRF synchronizer field carried by every state-changing form.
export function csrfField(token: string | undefined): string {
  return `<input type="hidden" name="_csrf" value="${escapeHtml(token)}">`;
}

// Only http(s), mailto and site-relative values may become clickable links.
// A stored "javascript:" or "data:" URL is rendered as inert escaped text, so a
// bad value in the data store cannot turn into stored XSS when a user clicks it.
function isSafeHref(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const v = value.trim().toLowerCase();
  return v.startsWith('http://') || v.startsWith('https://') || v.startsWith('mailto:') || v.startsWith('/');
}

export function layout({ title, body, currentEntity, user, csrf, flash }: LayoutOptions): string {
  let header: string;
  if (user) {
    const nav = ENTITIES.map((e) => {
      const current = e === currentEntity ? ' aria-current="page"' : '';
      return `<li><a href="/${PLURALS[e]}"${current}>${escapeHtml(e)}</a></li>`;
    }).join('');
    const logout = `<form method="POST" action="/logout" class="logout">${csrfField(csrf)}<button type="submit">Sign out</button></form>`;
    header = `<header>
<nav aria-label="Primary">
<ul>${nav}</ul>
</nav>
<p class="session">Signed in as <strong>${escapeHtml(user.username)}</strong> (${escapeHtml(user.role)}) ${logout}</p>
</header>`;
  } else {
    header = '<header><p><strong>CMS Admin</strong></p></header>';
  }
  const flashEl = flash ? `<p role="status">${escapeHtml(flash)}</p>` : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} — CMS Admin</title>
<link rel="stylesheet" href="/style.css">
</head>
<body>
${header}
<main>
<h1>${escapeHtml(title)}</h1>
${flashEl}
${body}
</main>
</body>
</html>
`;
}

export function displayName(item: Record<string, unknown> | null | undefined, entity: string): string {
  if (!item) return '';
  const keys = DISPLAY_KEYS[entity] || ['name', 'headline'];
  for (const k of keys) {
    const v = item[k];
    if (typeof v === 'string' && v) return v;
  }
  return (item.id as string | undefined) || '';
}

export function errorPage(status: number, message: string, user?: User | null): PageResult {
  return {
    status,
    html: layout({
      title: status === 404 ? 'Not Found' : 'Error',
      user,
      body: `<p role="alert">${escapeHtml(message)}</p>`,
    }),
  };
}

function formatScalar(value: unknown, use: string): string {
  if (use === 'URL') {
    if (!isSafeHref(value)) return escapeHtml(value);
    return `<a href="${escapeHtml(value)}" rel="noopener noreferrer">${escapeHtml(value)}</a>`;
  }
  if (use === 'DateTime' || use === 'Date' || use === 'Time') {
    return `<time datetime="${escapeHtml(value)}">${escapeHtml(value)}</time>`;
  }
  if (use === 'Boolean') return value ? 'Yes' : 'No';
  return escapeHtml(String(value));
}

export function formatValue(value: unknown, prop: Property): string {
  if (value === null || value === undefined || value === '') return '<em>—</em>';
  if (Array.isArray(value)) {
    if (!value.length) return '<em>—</em>';
    return `<ul>${value.map((v) => `<li>${formatValue(v, { ...prop, cardinality: 'one' } as Property)}</li>`).join('')}</ul>`;
  }
  if (prop.kind === 'Ref') {
    const target = prop.targets[0];
    const plural = PLURALS[target] || target.toLowerCase() + 's';
    return `<a href="/${plural}/${escapeHtml(value)}">${escapeHtml(target)}: ${escapeHtml(value)}</a>`;
  }
  if (prop.kind === 'Embed') {
    if (prop.use === 'Language' && typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      const code = obj.alternateName || obj.name || '';
      return `<span lang="${escapeHtml(code)}">${escapeHtml(code)}</span>`;
    }
    return `<code>${escapeHtml(JSON.stringify(value))}</code>`;
  }
  if (prop.kind === 'Enum') return escapeHtml(String(value));
  return formatScalar(value, prop.use);
}

const LONG_TEXT_HINT: Set<string> = new Set(['articleBody', 'description', 'text']);

export function renderField(
  { prop, value, refOptions = {}, errors = [] }:
  { prop: Property; value?: unknown; refOptions?: Record<string, RefOption[]>; errors?: string[] },
): string {
  const id = `field-${prop.name}`;
  const req = prop.required;
  const requiredAttr = req ? ' required' : '';
  const requiredMark = req ? ' <span aria-hidden="true">*</span>' : '';
  const ariaInvalid = errors.length ? ' aria-invalid="true"' : '';
  const labelText = `${escapeHtml(prop.name)}${requiredMark}`;
  const help = errors.length
    ? `<small role="alert">${errors.map((e) => escapeHtml(e)).join('; ')}</small>`
    : '';
  const input = renderInput({ prop, value, id, requiredAttr, ariaInvalid, refOptions });
  return `<p>
<label for="${id}">${labelText}</label><br>
${input}
${help}
</p>`;
}

function renderInput(
  { prop, value, id, requiredAttr, ariaInvalid, refOptions }:
  { prop: Property; value: unknown; id: string; requiredAttr: string; ariaInvalid: string; refOptions: Record<string, RefOption[]> },
): string {
  if (prop.kind === 'Enum') {
    const opts = prop.values.map((v) =>
      `<option value="${escapeHtml(v)}"${v === value ? ' selected' : ''}>${escapeHtml(v)}</option>`).join('');
    const placeholder = prop.required ? '' : '<option value="">—</option>';
    return `<select id="${id}" name="${escapeHtml(prop.name)}"${requiredAttr}${ariaInvalid}>${placeholder}${opts}</select>`;
  }
  if (prop.kind === 'Ref') {
    const current: any = prop.cardinality === 'many'
      ? (Array.isArray(value) ? value : (value ? [value] : []))
      : (Array.isArray(value) ? value[0] : value);
    const opts = (refOptions[prop.name] || []).map((o) => {
      const selected = prop.cardinality === 'many'
        ? current.includes(o.value)
        : current === o.value;
      return `<option value="${escapeHtml(o.value)}"${selected ? ' selected' : ''}>${escapeHtml(o.label)}</option>`;
    }).join('');
    const multiple = prop.cardinality === 'many' ? ' multiple' : '';
    const placeholder = prop.cardinality === 'one' && !prop.required ? '<option value="">—</option>' : '';
    return `<select id="${id}" name="${escapeHtml(prop.name)}"${multiple}${requiredAttr}${ariaInvalid}>${placeholder}${opts}</select>`;
  }
  if (prop.kind === 'Embed' && prop.use === 'Language') {
    const v = value && typeof value === 'object' ? ((value as Record<string, unknown>).alternateName || '') : (value || '');
    return `<input id="${id}" name="${escapeHtml(prop.name)}" type="text" value="${escapeHtml(v)}"${requiredAttr}${ariaInvalid}>`;
  }
  if (prop.cardinality === 'many') {
    const v = Array.isArray(value) ? value.join('\n') : (value || '');
    return `<textarea id="${id}" name="${escapeHtml(prop.name)}" rows="3"${requiredAttr}${ariaInvalid}>${escapeHtml(v)}</textarea>`;
  }
  if (prop.use === 'Text' && LONG_TEXT_HINT.has(prop.name)) {
    return `<textarea id="${id}" name="${escapeHtml(prop.name)}" rows="6"${requiredAttr}${ariaInvalid}>${escapeHtml(value || '')}</textarea>`;
  }
  if (prop.use === 'URL') {
    return `<input id="${id}" name="${escapeHtml(prop.name)}" type="url" value="${escapeHtml(value || '')}"${requiredAttr}${ariaInvalid}>`;
  }
  if (prop.use === 'Integer') {
    return `<input id="${id}" name="${escapeHtml(prop.name)}" type="number" step="1" value="${escapeHtml(value ?? '')}"${requiredAttr}${ariaInvalid}>`;
  }
  if (prop.use === 'Number') {
    return `<input id="${id}" name="${escapeHtml(prop.name)}" type="number" step="any" value="${escapeHtml(value ?? '')}"${requiredAttr}${ariaInvalid}>`;
  }
  if (prop.use === 'Boolean') {
    const checked = value === true || value === 'true' || value === 'on' ? ' checked' : '';
    return `<input id="${id}" name="${escapeHtml(prop.name)}" type="checkbox" value="true"${checked}${ariaInvalid}>`;
  }
  if (prop.use === 'DateTime' || prop.use === 'Date' || prop.use === 'Time') {
    const v = typeof value === 'string' ? value.replace(/Z$/, '').slice(0, 16) : '';
    return `<input id="${id}" name="${escapeHtml(prop.name)}" type="datetime-local" value="${escapeHtml(v)}"${requiredAttr}${ariaInvalid}>`;
  }
  return `<input id="${id}" name="${escapeHtml(prop.name)}" type="text" value="${escapeHtml(value || '')}"${requiredAttr}${ariaInvalid}>`;
}

function coerceFormValue(raw: unknown, prop: Property): unknown {
  if (raw === '' || raw === null || raw === undefined) return undefined;
  if (prop.kind === 'Enum' || prop.kind === 'Ref') return String(raw);
  if (prop.kind === 'Embed' && prop.use === 'Language') {
    return { '@type': 'Language', alternateName: String(raw) };
  }
  switch (prop.use) {
    case 'Integer': {
      const n = Number(raw);
      return Number.isFinite(n) ? Math.trunc(n) : raw;
    }
    case 'Number': {
      const n = Number(raw);
      return Number.isFinite(n) ? n : raw;
    }
    case 'Boolean':
      return raw === 'true' || raw === 'on' || raw === '1';
    case 'DateTime':
    case 'Date':
    case 'Time': {
      if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) {
        return raw + ':00Z';
      }
      return String(raw);
    }
    default:
      return String(raw);
  }
}

export function parseFormBody(form: URLSearchParams, properties: Property[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const prop of properties) {
    if (prop.cardinality === 'many') {
      let rawValues: string[];
      if (prop.kind === 'Ref') {
        rawValues = form.getAll(prop.name).filter((v) => v !== '');
      } else {
        const single = form.get(prop.name);
        rawValues = typeof single === 'string'
          ? single.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
          : [];
      }
      const coerced = rawValues.map((v) => coerceFormValue(v, prop));
      if (coerced.length) out[prop.name] = coerced;
    } else if (prop.kind === 'InlineScalar' && prop.use === 'Boolean') {
      out[prop.name] = form.has(prop.name);
    } else {
      const raw = form.get(prop.name);
      const v = coerceFormValue(raw, prop);
      if (v !== undefined) out[prop.name] = v;
    }
  }
  return out;
}

export function formValuesFromItem(
  item: Record<string, unknown> | null | undefined,
  properties: Property[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!item) return out;
  for (const prop of properties) {
    if (item[prop.name] !== undefined) out[prop.name] = item[prop.name];
  }
  return out;
}
