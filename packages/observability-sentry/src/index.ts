// Re-exported for convenience so a deployment can type its wiring without a
// second import from `@voyant-travel/hono/observability`.
export type { ErrorEvent, Reporter } from "@voyant-travel/hono/observability"
export type {
  SentryCaptureContext,
  SentryLike,
  SentryReporterOptions,
} from "./sentry-reporter.js"
export { sentryReporter } from "./sentry-reporter.js"
