# Cloudflare Worker Entrypoints

Voyant's Cloudflare SSR entrypoints must stay thin enough to pass Worker
startup validation. Cloudflare parses and executes module global scope before
any request routing happens, so entrypoint imports are part of the startup
budget even when the request is only serving SSR HTML.

## Rule

Do not statically import the Hono API app, scheduled job modules, or workflow
definition files from Cloudflare SSR entrypoints.

Prefer:

- cache a dynamic `import("./api/app")` inside the `/api/*` branch
- cache dynamic workflow runtime imports inside Durable Object step handling
- import only lightweight constants from leaf files
- route scheduled events by cron string, then dynamic-import the matching job

Avoid:

- `import { app as apiApp } from "./api/app"`
- `import "./workflows.js"`
- importing a package root only to read a runtime constant

The mechanical check lives in `scripts/check-cloudflare-entrypoints.mjs` and is
part of `pnpm verify:architecture`.

## Why

The operator template can install enough Voyant modules, schemas, workflows,
and local API routes that eagerly importing the API graph pushes Cloudflare
startup validation over the CPU limit. Lazy-loading keeps the first SSR
entrypoint small while preserving warm-isolate caching for API and workflow
requests.
