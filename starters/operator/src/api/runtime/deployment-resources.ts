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
import { createGeneratedGraphRuntimePorts } from "../../../.voyant/runtime/graph-runtime.generated"
import { resolveOperatorCustomFields } from "../../lib/custom-fields"
import { resolveNotificationProviders } from "../../lib/notifications"
import { withDbFromEnv } from "../lib/db"
import {
  createOperatorDocumentStorage,
  operatorBindings,
  operatorPostgresDb,
  readOperatorDocumentContentBase64,
  resolveOperatorDb,
  resolveOperatorDocumentDownloadUrl,
} from "./operator-runtime-adapter"
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
function createDeploymentCapabilities() {
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
        return (operatorBindings(bindings) as Record<string, unknown> | undefined)?.[key]
      },
    },
  }
}

/** Deployment implementations for package-declared runtime ports. */
function createDeploymentPortResources(
  capabilities: ReturnType<typeof createDeploymentCapabilities>,
  primitives: VoyantRuntimeHostPrimitives,
) {
  return createGeneratedGraphRuntimePorts({
    capabilities,
    primitives,
  })
}

/** All host-owned inputs passed to graph composition as one opaque resource set. */
export function createOperatorDeploymentResources() {
  const capabilities = createDeploymentCapabilities()
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
