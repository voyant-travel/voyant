# apps/workflows-tenant-worker

Reference tenant Worker for Voyant Workflows. Wraps a user's compiled
workflow bundle into a Worker that the orchestrator can dispatch to
through its Workers-for-Platforms namespace, with full support for
`runtime: "node"` steps via Cloudflare Containers.

## What this Worker does

Per invocation:

1. **Loads** the user's workflow bundle (staged as `./bundle.mjs` at
   deploy time) so `workflow()` registrations populate the local
   registry.
2. **Verifies** the orchestrator's `X-Voyant-Dispatch-Auth` HMAC
   header against `VOYANT_DISPATCH_SECRET` — rejects any request that
   didn't come from a trusted orchestrator.
3. **Routes** `POST /__voyant/workflow-step` through
   `@voyant-travel/workflows/handler`'s `createStepHandler`.
4. **Dispatches** `runtime: "node"` steps to the orchestrator's
   `NodeStepContainer` DO via `createCfContainerStepRunner`.
5. **Resolves** bundles to R2 URLs at dispatch time via
   `createR2Presigner`, so the container can fetch the matching
   `container.mjs` and verify its SHA-256 against a KV-registered
   manifest hash.

## Deploying

voyant-cloud's deploy pipeline owns the end-to-end flow. One deploy
per `(tenantId, workflowVersion)` into the orchestrator's WFP
namespace:

```bash
# 1. Build the tenant's bundle (produces dist/bundle.mjs and manifest.json).
voyant workflows build --file ./src/workflows.ts --out ./dist

# 2. Stage the bundle next to the tenant Worker source.
cp ./dist/bundle.mjs apps/workflows-tenant-worker/src/bundle.mjs

# 3. Upload container.mjs to R2 + register its SHA-256 in KV.
#    (One of two bundles — see docs/design.md §5.8.)
#    The container.mjs is a second build target if the workflow has
#    any `runtime: "node"` steps; omit if it's pure edge.

# 4. Deploy the tenant Worker into the orchestrator's dispatch namespace.
wrangler deploy --name "tenant-${PROJECT_ID}-${VERSION}" \
  --dispatch-namespace voyant-tenants
```

## Required secrets

```bash
# HMAC shared with the orchestrator for dispatch auth.
wrangler secret put VOYANT_DISPATCH_SECRET

# HMAC shared with the Node step container for runtime: "node" dispatches.
wrangler secret put VOYANT_WORKFLOW_STEP_AUTH_SECRET

# R2 credentials — read-only token scoped to the bundles bucket.
wrangler secret put R2_ACCESS_KEY_ID
wrangler secret put R2_SECRET_ACCESS_KEY
```

## Important wiring notes

- **`NODE_STEP_POOL` is a cross-Worker DO binding** — it references
  the `NodeStepContainer` class in the orchestrator Worker. The
  `script_name` in `wrangler.jsonc` must match the orchestrator's
  Worker name (`voyant-orchestrator` by default).
- **`VOYANT_WORKFLOW_STEP_AUTH_SECRET` must match the container
  environment** — `createCfContainerStepRunner` signs `/step`
  dispatches with this secret, and `apps/workflows-node-step-container`
  rejects unsigned requests unless unauthenticated mode is explicitly
  enabled.
- **`BUNDLE_R2` + `BUNDLE_HASHES`** must reference the same bucket /
  KV namespace as the orchestrator deploy. The container's outbound
  handlers resolve R2 reads through the orchestrator's bindings, but
  the tenant Worker presigns URLs directly.
- The `./bundle.mjs` import is a side-effect import — the compiled
  bundle's top-level `workflow()` calls register definitions into a
  shared process-local registry.

## Per-isolate state

The handler is built lazily on the first request inside each V8
isolate, then cached across subsequent invocations — so the rate
limiter's in-memory buckets + container namespace addressing survive
between dispatches within the same isolate.
