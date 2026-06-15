# schema.org aligned CMS Admin (TypeScript on Node.js)

[![Tests](https://github.com/ericbinek/cms-admin-node-typescript-ssr/actions/workflows/test.yml/badge.svg)](https://github.com/ericbinek/cms-admin-node-typescript-ssr/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![Status](https://img.shields.io/badge/status-work_in_progress-orange.svg)
![Build in public](https://img.shields.io/badge/build-in_public-ff69b4.svg)
![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)
![Node.js 24](https://img.shields.io/badge/Node.js-24-green.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)

A server rendered admin interface for a schema.org aligned CMS, written in plain TypeScript on Node.js 24.

Node 24 strips the types at startup, so there is no build step and no client framework. It serves semantic HTML from `node:http`, with ES modules in the browser and no bundler.

It is login protected and offers full create, edit, and delete management for 10 schema.org entity types such as BlogPosting, Person, and WebPage. It is a stateless proxy: the browser holds an HttpOnly session cookie, the server translates it into a bearer token for the CMS API, and the API stays the authority for authentication and permissions. State changing forms carry a CSRF synchronizer token.

A conformance test suite defines the markup and behavior.

## Status: work in progress (v0.1.0)

This is an ongoing build-in-public project, shared only for community and communication purposes. Do not deploy it in production. Do not rely on its interfaces or data format remaining stable.

## No build step

Node 24 runs TypeScript directly by stripping the type annotations at startup, so there is no compile step and nothing is emitted. The runtime is Node's standard library alone: `node:http`, `node:fs`, `node:test`. The only dependencies are dev-only and types-only: `typescript` and `@types/node`, used for the optional `npm run typecheck` (`tsc --noEmit`) in CI. The code stays within TypeScript's erasable-types subset, so it never needs a transpiler.

## Requirements

- Node.js 24 or newer

## Installation

```sh
git clone https://github.com/ericbinek/cms-admin-node-typescript-ssr.git
cd cms-admin-node-typescript-ssr
cp .env.example .env
```

## Running

```sh
node src/server.ts
```

The server listens on `PORT` (default 5008).

## Usage

Open http://localhost:5008/ in a browser and sign in. Accounts live in the CMS API; there is no self-registration.
Each entity has a list view at `/<plural>`, a detail view at `/<plural>/:id`, and create/edit/delete flows.

Configure the upstream API via the `API_BASE_URL` environment variable. Set `COOKIE_SECURE=true` when serving over HTTPS.

## Entities

- `BlogPosting`
- `Person`
- `WebPage`
- `ImageObject`
- `CategoryCode`
- `CategoryCodeSet`
- `DefinedTerm`
- `DefinedTermSet`
- `Comment`
- `WebSite`

## Testing

```sh
node --test "test/*.test.ts"
```

## Type checking

```sh
npm install
npm run typecheck
```

This installs the two dev-only packages and runs `tsc --noEmit` in strict mode. It is optional: the code runs without it.

## Contributing

Contributions are welcome. This is a build-in-public project, so issues, questions, and ideas count as much as pull requests. If you send code, keep it on Node's built in modules with no new runtime dependencies, stay within the erasable-types subset so Node can strip types without a build, and keep the conformance suite green, since the tests are the contract. Run them with `node --test "test/*.test.ts"`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guidelines.

## License

MIT. See [LICENSE](LICENSE).
