import { layout, escapeHtml, csrfField } from './layout.ts';
import type { PageResult } from './layout.ts';

export function renderLogin(
  { csrf, error, username = '' }: { csrf?: string; error?: string; username?: string } = {},
): PageResult {
  const errorBlock = error
    ? `<div role="alert"><p>${escapeHtml(error)}</p></div>`
    : '';
  return {
    status: error ? 401 : 200,
    html: layout({
      title: 'Sign in',
      body: `
${errorBlock}
<form method="POST" action="/login">
${csrfField(csrf)}
<p>
<label for="field-username">Username</label><br>
<input id="field-username" name="username" type="text" value="${escapeHtml(username)}" required autocomplete="username">
</p>
<p>
<label for="field-password">Password</label><br>
<input id="field-password" name="password" type="password" required autocomplete="current-password">
</p>
<p><button type="submit">Sign in</button></p>
</form>`,
    }),
  };
}
