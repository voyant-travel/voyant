# @voyant-travel/observability-sentry

Sentry adapter for the Voyant observability `Reporter` seam (RFC [voyant#1553](https://github.com/voyant-travel/voyant/issues/1553)).

The framework owns the **mechanism** — a request id minted once and propagated
(`X-Request-Id` + `getRequestId()`), standard catch points (5xx boundary, auth
sub-app, module bootstrap, event-bus subscribers, scheduled jobs), and a
normalized `ErrorEvent` shape. This package is the **opt-in sink**: it forwards
those events to Sentry, tagging each with the same `requestId` the user sees, so
a support reference is a one-paste lookup in Sentry issue search.

## Why an adapter and not a Sentry dependency

This package takes **no dependency on a Sentry SDK**. It binds to a structural
`SentryLike` interface, so you pass your already-initialized Sentry client —
`@sentry/cloudflare`, `@sentry/node`, `@sentry/bun`, `@sentry/browser`, any
version. Your deployment owns `init`/DSN/transport/sampling/PII scrubbing; the
adapter only maps the event and forwards it. The framework drains the buffered
event via `ctx.waitUntil` using the `flush()` the adapter returns — so you don't
hand-roll the Workers `flush`/`waitUntil` lifecycle that the RFC found broken in
three separate copies.

## Usage

```ts
import * as Sentry from "@sentry/cloudflare"
import { createApp } from "@voyant-travel/hono"
import { sentryReporter } from "@voyant-travel/observability-sentry"

const reporter = sentryReporter(Sentry)

const app = createApp({
  reporter,
  appName: "operator", // stamped on every event as the `app` tag
  modules,
})
```

That is the entire change — swap `consoleReporter()` (or the no-op default) for
`sentryReporter(Sentry)`. Every framework catch point now reaches Sentry.

### What lands on the Sentry issue

| `ErrorEvent` field | Sentry mapping |
| --- | --- |
| `requestId` | tag `request_id` (omitted when empty, e.g. background jobs) |
| `app` | tag `app` |
| `error` | the captured exception (non-`Error` values are wrapped so they still group with a stack) |
| `context` | nested under the `voyant` context group |

## Options

```ts
sentryReporter(Sentry, {
  requestIdTag: "request_id",  // tag key for the correlation id
  appTag: "app",               // tag key for the logical app name
  contextKey: "voyant",        // context group the `ErrorEvent.context` nests under
  flush: true,                 // default: flush when the client exposes flush() (Workers need it)
  flushTimeoutMs: 2000,        // flush timeout in ms
})
```

On long-lived Node/Bun servers you can pass `flush: false` to let Sentry's own
background transport deliver events instead of flushing per capture.

## License

Apache-2.0
