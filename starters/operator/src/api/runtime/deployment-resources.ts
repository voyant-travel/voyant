/**
 * Node deployment resources consumed by the generated graph runtime.
 *
 * Package selection and route composition belong to generated graph loaders.
 * This module is limited to concrete host resources whose implementations
 * depend on this deployment's bindings, database, storage, and process-local
 * registries.
 */

import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import { enqueueGraphWebhookEvent } from "@voyant-travel/distribution"
import { lazyProvider } from "@voyant-travel/hono"
import type { StorefrontIntakePersistence } from "@voyant-travel/storefront"
import type { WorkflowRunnerRegistryRuntime } from "@voyant-travel/workflow-runs/runtime-port"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { createGeneratedGraphRuntimePorts } from "../../../.voyant/runtime/graph-runtime.generated"
import { resolveOperatorCustomFields } from "../../lib/custom-fields"
import { resolveNotificationProviders } from "../../lib/notifications"
import { withDbFromEnv } from "../lib/db"
import { createOperatorCheckoutStartOptions } from "./catalog-checkout-options"
import { createOperatorNotificationsRuntimeProvider } from "./notifications-runtime"
import {
  createOperatorDocumentStorage,
  createOperatorInvoiceSettlementPollers,
  generateContractPdfForBooking,
  operatorBindings,
  operatorPostgresDb,
  operatorSmartbillRuntimeHost,
  readOperatorDocumentContentBase64,
  resolveOperatorDb,
  resolveOperatorDocumentDownloadUrl,
} from "./operator-runtime-adapter"
import { registerInventoryWorkflowService } from "./operator-workflow-services"
import { createOperatorTripsRoutesOptions } from "./trips-runtime"

type AsyncMethodProvider<T extends object> = {
  [K in keyof T]: T[K] extends (...args: infer Args) => infer Result
    ? (...args: Args) => Promise<Awaited<Result>>
    : never
}

/**
 * The operator deployment's capability container. Every template-specific
 * resolver/service a module factory needs is gathered here so wiring lives in
 * one typed place rather than being threaded through `createApp`.
 */
// The compatibility base retains only types still shared with this deployment;
// package runtime behavior is injected through typed graph ports below.
type OperatorRelationshipsService = Pick<
  typeof import("@voyant-travel/relationships").relationshipsService,
  "getPersonById"
>

/**
 * Build the operator provider container (gathers deployment resolvers/loaders).
 * Providers are bindings-deferred closures, so no `env` is needed here.
 */
function createBaseDeploymentCapabilities() {
  const storefrontIntakePersistence = lazyProvider<StorefrontIntakePersistence>(async () =>
    import("./storefront-intake-runtime").then(
      (m) =>
        m.createRelationshipsStorefrontIntakePersistence() as AsyncMethodProvider<StorefrontIntakePersistence>,
    ),
  )

  return {
    customFields: resolveOperatorCustomFields,
    resolveNotificationProviders,
    resolveDocumentDownloadUrl: resolveOperatorDocumentDownloadUrl,
    readDocumentContentBase64: readOperatorDocumentContentBase64,
    resolveDb: resolveOperatorDb,
    withDb: <T>(bindings: unknown, operation: (db: AnyDrizzleDb) => Promise<T>) =>
      withDbFromEnv(bindings as AppBindings, operation),
    createOperatorDocumentStorage,
    relationshipsService: lazyProvider<OperatorRelationshipsService>(async () =>
      import("@voyant-travel/relationships").then(
        (m) => m.relationshipsService as AsyncMethodProvider<OperatorRelationshipsService>,
      ),
    ),
    createTripsRoutesOptions: createOperatorTripsRoutesOptions,
    loadFlightsRuntime: () =>
      import("./flights-runtime").then((runtime) => runtime.operatorFlightsRuntime),
    loadQuoteProposalRuntime: () =>
      import("./quote-proposal-runtime").then((runtime) =>
        runtime.createQuoteProposalRoutesOptions(),
      ),
    loadNotificationsRuntime: createOperatorNotificationsRuntimeProvider,
    loadStorefrontRuntime: async () => {
      const [commerce, paymentLink] = await Promise.all([
        import("@voyant-travel/commerce"),
        import("./payment-link-runtime"),
      ])
      return {
        storefront: {
          offers: commerce.createCommerceStorefrontOfferResolvers(),
          bookingIntents: {
            withDb: (bindings: unknown, operation: (db: PostgresJsDatabase) => Promise<unknown>) =>
              withDbFromEnv(operatorBindings(bindings), (db) => operation(operatorPostgresDb(db))),
          },
          intake: { persistence: storefrontIntakePersistence },
        },
        paymentLink: paymentLink.createOperatorPaymentLinkRouteOptions(),
        customerPortal: {
          resolveDocumentDownloadUrl: resolveOperatorDocumentDownloadUrl,
        },
        verification: {
          resolveProviders: resolveNotificationProviders,
          email: { subject: "Your verification code" },
        },
      }
    },
  }
}

function createLegacyDeploymentCapabilities(
  workflowRunnerRegistry?: WorkflowRunnerRegistryRuntime,
) {
  const capabilities = createBaseDeploymentCapabilities()
  return {
    ...capabilities,
    resolveWorkflowRunnerRegistry: () => workflowRunnerRegistry,
    loadCommerceRuntime: createOperatorCommerceRuntime,
    loadInventoryRuntime: createOperatorInventoryRuntime,
    loadActionLedgerHealthRuntime: () =>
      import("./action-ledger-health-runtime").then((runtime) =>
        runtime.createOperatorActionLedgerHealthRuntime(),
      ),
    loadDistributionChannelPushRuntime: () =>
      import("./channel-push-runtime").then((runtime) => runtime.operatorChannelPushRuntime),
  }
}

function createNodeRuntimePrimitives(): VoyantRuntimeHostPrimitives {
  return {
    env: (bindings) => operatorBindings(bindings) as Record<string, unknown>,
    database: {
      resolve: <TDatabase>(bindings: unknown) =>
        resolveOperatorDb(bindings) as unknown as TDatabase,
      fromContext: <TDatabase>(context: unknown) =>
        operatorPostgresDb(
          (context as { get(key: string): Parameters<typeof operatorPostgresDb>[0] }).get("db"),
        ) as unknown as TDatabase,
      transaction: (bindings, operation) =>
        withDbFromEnv(operatorBindings(bindings), (database) => operation(database)),
    },
    storage: {
      resolve: createOperatorDocumentStorage,
      read: readOperatorDocumentContentBase64,
      downloadUrl: resolveOperatorDocumentDownloadUrl,
    },
    events: {
      deliver: (event, bindings) =>
        enqueueGraphWebhookEvent(
          resolveOperatorDb(bindings),
          event as Parameters<typeof enqueueGraphWebhookEvent>[1],
        ),
    },
    config: {
      read: (bindings, key) => {
        if (key === "customFields") return resolveOperatorCustomFields
        if (key === "notificationProviders") return resolveNotificationProviders
        if (key === "invoiceSettlementPollers") return createOperatorInvoiceSettlementPollers
        return (operatorBindings(bindings) as Record<string, unknown> | undefined)?.[key]
      },
    },
  }
}

/** Deployment implementations for package-declared runtime ports. */
function createDeploymentPortResources(
  capabilities: ReturnType<typeof createLegacyDeploymentCapabilities>,
  primitives: VoyantRuntimeHostPrimitives,
) {
  return createGeneratedGraphRuntimePorts({
    capabilities,
    primitives,
    // @voyant-travel/plugin-smartbill is external and its generated contributor
    // irreducibly requires resolveDatabase, resolveConfig, and resolveDocumentStorage.
    host: operatorSmartbillRuntimeHost,
  })
}

/** All host-owned inputs passed to graph composition as one opaque resource set. */
export function createOperatorDeploymentResources(
  workflowRunnerRegistry?: WorkflowRunnerRegistryRuntime,
) {
  const capabilities = createLegacyDeploymentCapabilities(workflowRunnerRegistry)
  const primitives = createNodeRuntimePrimitives()
  return {
    capabilities,
    primitives,
    ports: createDeploymentPortResources(capabilities, primitives),
    outboundWebhooks: {
      enqueue: (event: Parameters<typeof enqueueGraphWebhookEvent>[1], bindings: unknown) =>
        primitives.events.deliver(event, bindings),
    },
  }
}

function createOperatorCommerceRuntime() {
  return {
    bookingMaintenance: import("@voyant-travel/operator-settings").then((settings) => ({
      resolveDb: (context) => operatorPostgresDb(context.get("db")),
      resolveBookingTaxSettings: settings.resolveBookingTaxSettings,
    })),
    checkoutApi: (context) => createOperatorCheckoutStartOptions(context),
    checkoutDatabase: {
      withDb: <T>(
        bindings: unknown,
        operation: (db: PostgresJsDatabase) => Promise<T>,
      ): Promise<T> =>
        withDbFromEnv(operatorBindings(bindings), (db) => operation(operatorPostgresDb(db))),
    },
    checkoutLegal: import("@voyant-travel/legal/contracts").then(({ contractsService }) => ({
      getContract: contractsService.getContractById,
      listSignatures: contractsService.listSignatures,
      sendContract: (db, contractId, eventBus) =>
        contractsService.sendContract(db, contractId, { eventBus }),
      signContract: (db, contractId, input, eventBus) =>
        contractsService.signContract(db, contractId, input as never, { eventBus }),
    })),
    checkoutContractPdf: {
      generate: ({ bindings, db, eventBus, bookingId, force }) =>
        generateContractPdfForBooking(
          createNodeRuntimePrimitives(),
          bindings,
          db,
          eventBus,
          bookingId,
          { force },
        ),
    },
    promotionRedemptionDatabase: {
      withDb: <T>(bindings: unknown, operation: (db: AnyDrizzleDb) => Promise<T>): Promise<T> =>
        withDbFromEnv(operatorBindings(bindings), (db) => operation(operatorPostgresDb(db))),
    },
    promotionsBulkReindex: {
      createService: (bindings: unknown) =>
        import("../lib/bulk-reindex-service").then((runtime) =>
          runtime.createBulkReindexProductsService(operatorBindings(bindings)),
        ),
    },
  }
}

function createOperatorInventoryRuntime() {
  return {
    inventory: {
      bootstrap: ({ container, bindings }) =>
        registerInventoryWorkflowService(container, bindings as AppBindings),
    },
  }
}
