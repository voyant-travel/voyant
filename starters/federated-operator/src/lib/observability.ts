import { consoleReporter, safeCaptureException } from "@voyant-travel/hono/observability/reporter"

export const FEDERATED_OPERATOR_APP_NAME = "federated-operator"

export const federatedOperatorReporter = consoleReporter()

export function reportBackgroundFailure(
  job: string,
  error: unknown,
  context?: Record<string, unknown>,
): void {
  safeCaptureException(federatedOperatorReporter, {
    requestId: "",
    app: FEDERATED_OPERATOR_APP_NAME,
    error,
    context: { job, surface: "scheduled", ...context },
  })
}
