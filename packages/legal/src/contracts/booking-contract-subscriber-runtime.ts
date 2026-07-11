import type { ActionLedgerRequestContextValues } from "@voyant-travel/action-ledger"
import type { BookingPiiService } from "@voyant-travel/bookings"
import type { ModuleContainer, SubscriberRuntimeDescriptor } from "@voyant-travel/core"
import { defineGraphRuntimeFactory } from "@voyant-travel/core/project"
import type { StorageProvider } from "@voyant-travel/storage"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { legalBookingContractSubscriberRuntimePort } from "./booking-contract-subscriber-port.js"
import type { ContractLifecycleHook } from "./lifecycle.js"
import {
  type AutoGenerateContractOptions,
  type AutoGenerateContractResult,
  autoGenerateContractForBooking,
} from "./service-auto-generate.js"
import type {
  BookingConfirmedLikeEvent,
  ResolveContractVariablesFn,
} from "./service-auto-generate-types.js"
import type { ContractDocumentGenerator } from "./service-documents.js"

export const LEGAL_BOOKING_CONTRACT_SUBSCRIBER_ID =
  "@voyant-travel/legal#subscriber.booking-contract-confirmed"
export const LEGAL_BOOKING_CONTRACT_SUBSCRIBER_RUNTIME_KEY =
  "legal.bookingContractSubscriberRuntime"

export interface LegalBookingConfirmedEvent extends BookingConfirmedLikeEvent {
  /** Notification suppression does not suppress the independently owned Legal artifact. */
  suppressNotifications?: boolean
}

export interface LegalBookingContractSubscriberRuntime<TBindings = unknown> {
  options: AutoGenerateContractOptions
  /** Own the deployment database lifecycle for the complete generation operation. */
  withDb<TResult>(
    bindings: TBindings,
    operation: (db: PostgresJsDatabase) => Promise<TResult>,
  ): Promise<TResult>
  documentGenerator: ContractDocumentGenerator
  /** Storage is exposed for deployment adapters; generation consumes its storage-backed generator. */
  documentStorage?: StorageProvider | null
  bookingPiiService?: BookingPiiService | null
  resolveBookingPiiService?: () =>
    | BookingPiiService
    | Promise<BookingPiiService | null | undefined>
    | null
    | undefined
  lifecycleHooks?: readonly ContractLifecycleHook[]
  resolveVariables?: ResolveContractVariablesFn
  resolveActionLedgerContext(
    event: LegalBookingConfirmedEvent,
  ): ActionLedgerRequestContextValues | null
}

export interface LegalBookingContractSubscriberDependencies {
  generateContract?: typeof autoGenerateContractForBooking
  logger?: Pick<Console, "error">
}

/** Build the package-owned descriptor while leaving graph activation to a later cutover. */
export function createLegalBookingContractSubscriberDescriptor(
  dependencies: LegalBookingContractSubscriberDependencies = {},
): SubscriberRuntimeDescriptor {
  const generateContract = dependencies.generateContract ?? autoGenerateContractForBooking
  const logger = dependencies.logger ?? console

  return {
    id: LEGAL_BOOKING_CONTRACT_SUBSCRIBER_ID,
    eventType: "booking.confirmed",
    register: ({ bindings, container, eventBus }) => {
      eventBus.subscribe<LegalBookingConfirmedEvent>("booking.confirmed", async ({ data }) => {
        const runtime = resolveLegalBookingContractSubscriberRuntime(container)
        if (!runtime.options.enabled) return

        try {
          const result = await runtime.withDb(bindings, async (db) =>
            generateContract(
              db,
              data,
              {
                ...runtime.options,
                resolveVariables: runtime.resolveVariables ?? runtime.options.resolveVariables,
              },
              {
                generator: runtime.documentGenerator,
                eventBus,
                lifecycleHooks: runtime.lifecycleHooks,
                bindings: bindings as Record<string, unknown>,
                bookingPiiService:
                  runtime.bookingPiiService ?? (await runtime.resolveBookingPiiService?.()) ?? null,
                actionLedgerContext: runtime.resolveActionLedgerContext(data),
              },
            ),
          )
          logNonSuccessResult(logger, data.bookingId, result)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          logger.error(
            `[legal] auto-generate contract failed for booking ${data.bookingId}: ${message}`,
          )
        }
      })
    },
  }
}

function resolveLegalBookingContractSubscriberRuntime(
  container: ModuleContainer,
): LegalBookingContractSubscriberRuntime {
  if (!container.has(LEGAL_BOOKING_CONTRACT_SUBSCRIBER_RUNTIME_KEY)) {
    throw new Error(
      `Legal booking-contract subscriber runtime is not registered at "${LEGAL_BOOKING_CONTRACT_SUBSCRIBER_RUNTIME_KEY}".`,
    )
  }
  return container.resolve<LegalBookingContractSubscriberRuntime>(
    LEGAL_BOOKING_CONTRACT_SUBSCRIBER_RUNTIME_KEY,
  )
}

export function registerLegalBookingContractSubscriberRuntime(
  container: ModuleContainer,
  runtime: LegalBookingContractSubscriberRuntime,
): void {
  container.register(LEGAL_BOOKING_CONTRACT_SUBSCRIBER_RUNTIME_KEY, runtime)
}

function logNonSuccessResult(
  logger: Pick<Console, "error">,
  bookingId: string,
  result: AutoGenerateContractResult,
) {
  if (result.status !== "ok") {
    logger.error(
      `[legal] auto-generate contract skipped for booking ${bookingId}: ${result.status}`,
    )
  }
}

export const legalBookingContractConfirmedSubscriber =
  createLegalBookingContractSubscriberDescriptor()

/** Selected-graph adapter from the declared host port to the runtime container. */
export const createLegalBookingContractVoyantRuntime = defineGraphRuntimeFactory(
  async ({ getPort }) => {
    const host = await getPort(legalBookingContractSubscriberRuntimePort)
    return {
      extension: {
        name: "booking-contract",
        module: "legal",
        bootstrap: async ({ bindings, container }) => {
          const runtime = await host.createRuntime(bindings)
          if (runtime) registerLegalBookingContractSubscriberRuntime(container, runtime)
        },
      },
    }
  },
)

export {
  type LegalBookingContractSubscriberHost,
  legalBookingContractSubscriberRuntimePort,
} from "./booking-contract-subscriber-port.js"
