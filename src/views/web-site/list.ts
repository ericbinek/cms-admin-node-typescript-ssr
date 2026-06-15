import { layout, escapeHtml, displayName, formatValue } from '../layout.ts';
import type { Property, PageResult, User } from '../layout.ts';
import type { BoundApi } from '../../api-client.ts';

const ENTITY = "WebSite";
const BASE = "/web-sites";
const PROPERTIES: Property[] = [
  { name: "name", kind: 'InlineScalar', use: "Text", cardinality: "one", required: true },
  { name: "description", kind: 'InlineScalar', use: "Text", cardinality: "one", required: false },
  { name: "url", kind: 'InlineScalar', use: "URL", cardinality: "one", required: true },
  { name: "inLanguage", kind: 'Embed', use: "Language", cardinality: "one", required: false },
  { name: "image", kind: 'Ref', targets: ["ImageObject"], cardinality: "one", required: false },
];
const EXTRA_COLS: string[] = ["url"];

export async function render(
  { url, api, user, csrf }: { url: URL; api: BoundApi; user: User; csrf: string },
): Promise<PageResult> {
  const sp = url.searchParams;
  const query: Record<string, string> = {};
  for (const k of ['limit', 'offset', 'sort', 'order']) {
    const v = sp.get(k);
    if (v !== null) query[k] = v;
  }
  const { status, body } = await api.list(ENTITY, query);
  if (status !== 200) {
    return {
      status,
      html: layout({
        title: ENTITY + 's',
        currentEntity: ENTITY,
        user,
        csrf,
        body: `<p role="alert">Failed to load: ${escapeHtml(body?.message || 'unknown error')}</p>`,
      }),
    };
  }
  const headers = ['Name', 'Created', ...EXTRA_COLS, 'Actions']
    .map((h) => `<th scope="col">${escapeHtml(h)}</th>`).join('');
  const rows = body.items.map((item: any) => {
    const extras = EXTRA_COLS.map((col) => {
      const prop = PROPERTIES.find((p) => p.name === col);
      return `<td>${prop ? formatValue(item[col], prop) : escapeHtml(String(item[col] ?? ''))}</td>`;
    }).join('');
    return `<tr>
<td><a href="${BASE}/${escapeHtml(item.id)}">${escapeHtml(displayName(item, ENTITY))}</a></td>
<td><time datetime="${escapeHtml(item.dateCreated || '')}">${escapeHtml(item.dateCreated || '')}</time></td>
${extras}
<td><a href="${BASE}/${escapeHtml(item.id)}/edit">Edit</a> · <a href="${BASE}/${escapeHtml(item.id)}/delete">Delete</a></td>
</tr>`;
  }).join('');
  const empty = '<tr><td colspan="' + (3 + EXTRA_COLS.length) + '"><em>No items.</em></td></tr>';
  const limit = Math.max(1, parseInt(sp.get('limit') || '20', 10) || 20);
  const offset = Math.max(0, parseInt(sp.get('offset') || '0', 10) || 0);
  const pageHref = (nextOffset: number): string => {
    const q = new URLSearchParams(sp);
    q.set('offset', String(nextOffset));
    return BASE + '?' + q.toString();
  };
  const prevLink = offset > 0
    ? `<a href="${escapeHtml(pageHref(Math.max(0, offset - limit)))}" rel="prev">Previous</a>`
    : '';
  const nextLink = offset + limit < body.total
    ? `<a href="${escapeHtml(pageHref(offset + limit))}" rel="next">Next</a>`
    : '';
  const pagination = (prevLink || nextLink)
    ? `<nav aria-label="Pagination">${prevLink}${nextLink}</nav>`
    : '';
  return {
    status: 200,
    html: layout({
      title: ENTITY + 's',
      currentEntity: ENTITY,
      user,
      csrf,
      body: `
<p><a href="${BASE}/new">New ${escapeHtml(ENTITY)}</a></p>
<p>Showing ${body.items.length} of ${body.total}.</p>
<table>
<caption>${escapeHtml(ENTITY)} list</caption>
<thead><tr>${headers}</tr></thead>
<tbody>${rows || empty}</tbody>
</table>
${pagination}`,
    }),
  };
}
