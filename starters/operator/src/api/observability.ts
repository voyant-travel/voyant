import { consoleReporter } from "@voyant-travel/hono/observability"

/** Logical app name stamped on emitted error events (RFC voyant#1553). */
export const OPERATOR_APP_NAME = "operator"

/**
 * Shared observability sink for the operator. Forwards unhandled 5xx — each
 * tagged with the same `requestId` surfaced to the user on `X-Request-Id` — to
 * the Workers log drain via the built-in console reporter. Swap for a
 * Sentry/OpenTelemetry adapter by changing this one line.
 *
 * Used by BOTH the full API app (`api/app.ts`) and the lean auth app
 * (`api/auth/handler.ts`): the latter is dispatched around `createVoyantApp`
 * (see `hono-api-dispatch.ts`), so it has to opt into the same sink explicitly
 * or auth 5xx would never reach telemetry.
 */
export const operatorReporter = consoleReporter()
