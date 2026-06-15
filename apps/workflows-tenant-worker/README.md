# apps/workflows-tenant-worker

Reference tenant Worker for legacy Cloudflare-hosted Voyant Workflows
experiments. Managed Voyant Cloud now executes workflow bundles through the
hosted Node runtime; app code should normally use
`@voyant-travel/workflows/client`.

## What this Worker does

Per invocation:

1. Loads the user's workflow bundle from `./bundle.mjs` so top-level
   `workflow()` registrations populate the local registry.
2. Verifies the orchestrator's `X-Voyant-Dispatch-Auth` HMAC header against
   `VOYANT_DISPATCH_SECRET`.
3. Routes `POST /__voyant/workflow-step` through
   `@voyant-travel/workflows/handler`'s `createStepHandler`.

## Deploying

```bash
voyant workflows build --file ./src/workflows.ts --out ./dist
cp ./dist/bundle.mjs apps/workflows-tenant-worker/src/bundle.mjs
wrangler deploy --name "tenant-${PROJECT_ID}-${VERSION}" \
  --dispatch-namespace voyant-tenants
```

## Required Secrets

```bash
wrangler secret put VOYANT_DISPATCH_SECRET
```

The `./bundle.mjs` import is a side-effect import: the compiled bundle's
top-level `workflow()` calls register definitions into a shared process-local
registry.
