import { layout, escapeHtml, displayName, formatValue, errorPage } from '../layout.ts';
import type { Property, PageResult, User } from '../layout.ts';
import type { BoundApi } from '../../api-client.ts';

const ENTITY = "Comment";
const BASE = "/comments";
const PROPERTIES: Property[] = [
  { name: "text", kind: 'InlineScalar', use: "Text", cardinality: "one", required: true },
  { name: "author", kind: 'Ref', targets: ["Person"], cardinality: "one", required: true },
  { name: "about", kind: 'Ref', targets: ["BlogPosting"], cardinality: "one", required: true },
  { name: "parentItem", kind: 'Ref', targets: ["Comment"], cardinality: "one", required: false },
  { name: "dateCreated", kind: 'InlineScalar', use: "DateTime", cardinality: "one", required: false },
  { name: "dateModified", kind: 'InlineScalar', use: "DateTime", cardinality: "one", required: false },
  { name: "upvoteCount", kind: 'InlineScalar', use: "Integer", cardinality: "one", required: false },
  { name: "downvoteCount", kind: 'InlineScalar', use: "Integer", cardinality: "one", required: false },
  { name: "creativeWorkStatus", kind: 'Enum', values: ["Pending","Approved","Spam","Trash"], cardinality: "one", required: false },
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
