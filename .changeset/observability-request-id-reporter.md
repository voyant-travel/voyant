---
"@voyant-travel/hono": minor
---

Add vendor-neutral observability primitives (RFC voyant#1553).

- **Request-id async context** — the `requestId` middleware now stores the correlation id on the `requestId` context variable and runs the request inside an `AsyncLocalStorage`, so any downstream code (services, subscribers, reporters) can read it via the new `getRequestId()` export — no header threading or `Context` access required. Error responses now also carry the `X-Request-Id` header. New exports: `getRequestId`, `runWithRequestId` (from the package root and `@voyant-travel/hono/observability`).
- **Pluggable error `Reporter`** — `VoyantAppConfig` gains `reporter` and `appName`. Unhandled 5xx exceptions at the `fetch` catch point emit a normalized `{ requestId, app, error, context }` event to the configured `Reporter`, where `requestId` is the same id surfaced to the user. The default is a no-op (zero vendor coupling); a built-in `consoleReporter` is provided, and Sentry/OpenTelemetry backends can be wired as opt-in adapters implementing the exported `Reporter` interface. Capture is best-effort — it never throws and async reporters are flushed via `waitUntil`. New exports: `Reporter`, `ErrorEvent`, `noopReporter`, `consoleReporter`.

The framework owns the id, the catch points, and the event shape; the backend stays a deployment choice. No behavior change for existing deployments that don't set `reporter`.
