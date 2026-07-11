import type { EventBus } from "@voyant-travel/core"
import type { WorkflowRunner } from "@voyant-travel/workflow-runs"
import type {
  CatalogCheckoutContractPdfGenerator,
  DispatchCheckoutFinalizeParams,
} from "./finalize.js"
import { dispatchCheckoutFinalize } from "./finalize.js"
import type { CatalogCheckoutDatabaseRuntime } from "./runtime-ports.js"

export interface CheckoutFinalizeRunnerRegistry {
  register(runner: WorkflowRunner): void
}

export interface CheckoutFinalizeRunnerRegistrationOptions<TBindings = unknown>
  extends CatalogCheckoutDatabaseRuntime {
  bindings: TBindings
  eventBus: EventBus
  registry: CheckoutFinalizeRunnerRegistry
  generateContractPdf?: CatalogCheckoutContractPdfGenerator
  dispatchFinalize?: typeof dispatchCheckoutFinalize
}

function requireCheckoutFinalizeInput(rawInput: unknown, action: "rerun" | "resume") {
  const input = rawInput as DispatchCheckoutFinalizeParams["input"] | null
  if (!input?.bookingId) {
    throw new Error(`checkout-finalize ${action}: recorded input has no bookingId`)
  }
  return input
}

/** Create the package-owned dashboard runner registration. */
export function createCheckoutFinalizeWorkflowRunner<TBindings = unknown>(
  options: Omit<CheckoutFinalizeRunnerRegistrationOptions<TBindings>, "registry">,
): WorkflowRunner {
  const dispatchFinalize = options.dispatchFinalize ?? dispatchCheckoutFinalize

  return {
    name: "checkout-finalize",
    idempotency: "unsafe",
    description:
      "Confirms the booking and issues the final invoice. A fresh rerun issues another invoice number; use Resume to retry from a failed step.",
    rerun: async (rawInput, context) => {
      const input = requireCheckoutFinalizeInput(rawInput, "rerun")
      return options.withDb(options.bindings, (db) =>
        dispatchFinalize({
          db,
          eventBus: options.eventBus,
          input,
          trigger: "manual.rerun",
          correlationId: context.correlationId,
          tags: [...context.tags, "rerun:true"],
          parentRunId: context.parentRunId,
          triggeredByUserId: context.triggeredByUserId,
          generateContractPdf: options.generateContractPdf,
        }),
      )
    },
    resume: async (rawInput, context) => {
      const input = requireCheckoutFinalizeInput(rawInput, "resume")
      return options.withDb(options.bindings, (db) =>
        dispatchFinalize({
          db,
          eventBus: options.eventBus,
          input,
          trigger: "manual.resume",
          correlationId: context.correlationId,
          tags: [...context.tags, "resume:true"],
          parentRunId: context.parentRunId,
          triggeredByUserId: context.triggeredByUserId,
          resumeFromStep: context.resumeFromStep,
          seedResults: context.seedResults,
          generateContractPdf: options.generateContractPdf,
        }),
      )
    },
  }
}

/** Register the package-owned runner without exposing its workflow metadata to the host. */
export function registerCheckoutFinalizeWorkflowRunner<TBindings = unknown>(
  options: CheckoutFinalizeRunnerRegistrationOptions<TBindings>,
): WorkflowRunner {
  const { registry, ...runnerOptions } = options
  const runner = createCheckoutFinalizeWorkflowRunner(runnerOptions)
  registry.register(runner)
  return runner
}
