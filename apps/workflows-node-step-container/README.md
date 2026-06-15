# @voyant-travel/workflows-node-step-container

Legacy standalone Node HTTP server for executing a single workflow step from an
external dispatcher. It is kept for compatibility with older experiments. The
current managed Cloud runtime uses the Node runner in the `voyant-cloud`
repository, not this Cloudflare container path.

The server accepts `POST /step`, verifies `x-voyant-step-auth` when
`VOYANT_WORKFLOW_STEP_AUTH_SECRET` is set, loads a baked or fetched workflow
bundle, executes the requested step, and returns a signed `StepJournalEntry`
when the same secret is configured.

## Run

```bash
pnpm --filter @voyant-travel/workflows-node-step-container build
pnpm --filter @voyant-travel/workflows-node-step-container start
```

Single-tenant images can set `WORKFLOW_BUNDLE` to a local bundle path.
Multi-tenant legacy callers can include `bundle: { url, hash }` in the dispatch
payload; the server verifies the fetched bytes against the supplied SHA-256
hash before import.

Use `@voyant-travel/workflows-orchestrator-node` for supported self-host
runtime work.
