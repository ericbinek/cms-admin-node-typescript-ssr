import { layout, escapeHtml, csrfField, displayName, errorPage } from '../layout.ts';
import type { PageResult, SubmitResult, User } from '../layout.ts';
import type { BoundApi } from '../../api-client.ts';

const ENTITY = "CategoryCode";
const BASE = "/category-codes";

export async function renderForm(
  { id, api, csrf, user }: { id: string; api: BoundApi; csrf: string; user: User },
): Promise<PageResult> {
  const { status, body } = await api.get(ENTITY, id);
  if (status === 404) return errorPage(404, ENTITY + ' not found.', user);
  if (status !== 200) return errorPage(status, body?.message || 'Failed to load.', user);
  return {
    status: 200,
    html: layout({
      title: 'Delete ' + ENTITY,
      currentEntity: ENTITY,
      user,
      csrf,
      body: `
<form method="POST" action="${BASE}/${escapeHtml(id)}/delete">
${csrfField(csrf)}
<p>Delete <strong>${escapeHtml(displayName(body, ENTITY))}</strong>? This cannot be undone.</p>
<p><button type="submit">Confirm Delete</button> · <a href="${BASE}/${escapeHtml(id)}">Cancel</a></p>
</form>`,
    }),
  };
}

export async function handleSubmit(
  { api, id, user }: { api: BoundApi; id: string; user: User },
): Promise<SubmitResult> {
  const { status } = await api.remove(ENTITY, id);
  if (status === 204 || status === 404) {
    return { status: 303, redirect: BASE };
  }
  return errorPage(status, 'Delete failed.', user);
}
