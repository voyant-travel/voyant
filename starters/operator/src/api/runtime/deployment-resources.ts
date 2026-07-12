/**
 * Node deployment resources consumed by the generated graph runtime.
 *
 * Package selection and route composition belong to generated graph loaders.
 * This module is limited to concrete host resources whose implementations
 * depend on this deployment's bindings, database, storage, and process-local
 * registries.
 */

import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import { withNodeDatabase } from "@voyant-travel/db/runtime"
import { enqueueGraphWebhookEvent } from "@voyant-travel/distribution"
import { createGeneratedGraphRuntimePorts } from "../../../.voyant/runtime/graph-runtime.generated"
import { resolveOperatorCustomFields } from "../../lib/custom-fields"
import { resolveNotificationProviders } from "../../lib/notifications"
import {
  createOperatorDocumentStorage,
  operatorBindings,
  operatorPostgresDb,
  readOperatorDocumentContentBase64,
  resolveOperatorDb,
  resolveOperatorDocumentDownloadUrl,
} from "./operator-runtime-adapter"

function createNodeRuntimePrimitives(): VoyantRuntimeHostPrimitives {
  return {
    env: (bindings) => operatorBindings(bindings),
    database: {
      resolve: <TDatabase>(bindings: unknown) =>
        resolveOperatorDb(bindings) as unknown as TDatabase,
      fromContext: <TDatabase>(context: unknown) =>
        operatorPostgresDb(
          (context as { get(key: string): Parameters<typeof operatorPostgresDb>[0] }).get("db"),
        ) as unknown as TDatabase,
      transaction: (bindings, operation) =>
        withNodeDatabase(operatorBindings(bindings), (database) => operation(database)),
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
        return operatorBindings(bindings)?.[key]
      },
    },
  }
}

/** Deployment implementations for package-declared runtime ports. */
function createDeploymentPortResources(primitives: VoyantRuntimeHostPrimitives) {
  return createGeneratedGraphRuntimePorts({ primitives })
}

/** All host-owned inputs passed to graph composition as one opaque resource set. */
export function createOperatorDeploymentResources() {
  const primitives = createNodeRuntimePrimitives()
  return {
    capabilities: {},
    primitives,
    ports: createDeploymentPortResources(primitives),
    outboundWebhooks: {
      enqueue: (event: Parameters<typeof enqueueGraphWebhookEvent>[1], bindings: unknown) =>
        primitives.events.deliver(event, bindings),
    },
  }
}
