import { layout, escapeHtml, displayName, formatValue, errorPage } from '../layout.ts';
import type { Property, PageResult, User } from '../layout.ts';
import type { BoundApi } from '../../api-client.ts';

const ENTITY = "CategoryCode";
const BASE = "/category-codes";
const PROPERTIES: Property[] = [
  { name: "name", kind: 'InlineScalar', use: "Text", cardinality: "one", required: true, maxLength: 256 },
  { name: "description", kind: 'InlineScalar', use: "Text", cardinality: "one", required: false, maxLength: 5000, multiline: true },
  { name: "codeValue", kind: 'InlineScalar', use: "Text", cardinality: "one", required: true, maxLength: 128 },
  { name: "url", kind: 'InlineScalar', use: "URL", cardinality: "one", required: false, maxLength: 2048 },
  { name: "inCodeSet", kind: 'Ref', targets: ["CategoryCodeSet"], cardinality: "one", required: true },
];

export async function render(
  { id, api, user, csrf }: { id: string; api: BoundApi; user: User; csrf: string },
): Promise<PageResult> {
  const { status, body } = await api.get(ENTITY, id);
  if (status === 404) return errorPage(404, ENTITY + ' not found.', user);
  if (status !== 200) return errorPage(status, body?.message || 'Failed to load.', user);
  const item = body;
  const rows = PROPERTIES.map((p) =>
    `<dt>${escapeHtml(p.name)}</dt><dd>${formatValue(item[p.name], p)}</dd>`).join('');
  const meta = `<dt>id</dt><dd><code>${escapeHtml(item.id)}</code></dd>
<dt>dateCreated</dt><dd><time datetime="${escapeHtml(item.dateCreated || '')}">${escapeHtml(item.dateCreated || '')}</time></dd>
<dt>dateModified</dt><dd><time datetime="${escapeHtml(item.dateModified || '')}">${escapeHtml(item.dateModified || '')}</time></dd>`;
  return {
    status: 200,
    html: layout({
      title: displayName(item, ENTITY),
      currentEntity: ENTITY,
      user,
      csrf,
      body: `
<article>
<dl>${rows}${meta}</dl>
<p>
<a href="${BASE}/${escapeHtml(item.id)}/edit">Edit</a> ·
<a href="${BASE}/${escapeHtml(item.id)}/delete">Delete</a> ·
<a href="${BASE}">Back to list</a>
</p>
</article>`,
    }),
  };
}
