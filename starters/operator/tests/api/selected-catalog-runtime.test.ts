import {
  CATALOG_BOOKING_SNAPSHOT_RUNTIME_CONTAINER_KEY,
  catalogBookingSnapshotRuntimePort,
} from "@voyant-travel/catalog/booking-snapshot-subscriber"
import {
  CATALOG_PROJECTION_RUNTIME_CONTAINER_KEY,
  catalogProjectionRuntimePort,
} from "@voyant-travel/catalog/projection-runtime"
import { createContainer, createEventBus } from "@voyant-travel/core"
import { composeVoyantGraphRuntime } from "@voyant-travel/framework"
import {
  createVoyantNodeEnv,
  createVoyantNodeRuntimeHostPrimitives,
} from "@voyant-travel/framework/node-runtime"
import { createOperatorDeploymentResources } from "@voyant-travel/operator-runtime/deployment-resources"
import { WorkflowRunnerRegistry } from "@voyant-travel/workflow-runs"
import { describe, expect, it, vi } from "vitest"

import {
  createGeneratedGraphRuntime,
  createGeneratedGraphRuntimePorts,
} from "./generated-project-runtime.js"

const createDeploymentResources = () => {
  const env = createVoyantNodeEnv({ DATABASE_URL: "postgres://test" })
  const primitives = createVoyantNodeRuntimeHostPrimitives({
    env,
    deliverEvent: async () => undefined,
  })
  return createOperatorDeploymentResources({
    primitives,
    createRuntimePorts: createGeneratedGraphRuntimePorts,
  })
}
const buildOperatorProviders = () => createDeploymentResources().capabilities
const buildOperatorRuntimePorts = (_registry?: WorkflowRunnerRegistry) =>
  createDeploymentResources().ports

async function composeOperatorGraph(runtime = createGeneratedGraphRuntime()) {
  return composeVoyantGraphRuntime({
    runtime,
    capabilities: buildOperatorProviders(),
    ports: buildOperatorRuntimePorts(new WorkflowRunnerRegistry()),
  })
}

describe("selected Operator Catalog subscriber composition", () => {
  it("activates selected Catalog subscribers once before stacked Commerce redemption", async () => {
    const runtime = createGeneratedGraphRuntime()
    const catalog = runtime.modules.find((unit) => unit.id === "@voyant-travel/catalog")
    const composed = await composeOperatorGraph(runtime)
    const catalogRuntimeIndex = composed.modules.findIndex(
      (module) => module.module.name === "catalog.graph-runtime",
    )
    const commerceRuntimeIndex = composed.modules.findIndex(
      (module) => module.module.name === "commerce.graph-runtime",
    )
    const container = createContainer()
    const eventBus = createEventBus()
    const subscribe = vi.spyOn(eventBus, "subscribe")

    await composed.modules[catalogRuntimeIndex]?.module.bootstrap?.({
      bindings: { DATABASE_URL: "postgres://test" },
      container,
      eventBus,
    })

    expect(
      catalog?.references
        .filter((reference) => reference.facet === "subscribers.runtime")
        .map((reference) => reference.entityId),
    ).toHaveLength(9)
    expect(catalogRuntimeIndex).toBeGreaterThanOrEqual(0)
    expect(commerceRuntimeIndex).toBeGreaterThan(catalogRuntimeIndex)
    expect(container.has(CATALOG_PROJECTION_RUNTIME_CONTAINER_KEY)).toBe(true)
    expect(container.has(CATALOG_BOOKING_SNAPSHOT_RUNTIME_CONTAINER_KEY)).toBe(true)
    expect(subscribe).toHaveBeenCalledTimes(9)
    expect(subscribe.mock.calls.filter(([event]) => event === "booking.confirmed")).toHaveLength(1)
    expect(
      subscribe.mock.calls.filter(([event]) => event === "product.publication.changed"),
    ).toHaveLength(1)
  })

  it("shares one Catalog projection runtime across all selected index subscribers", async () => {
    const provider = (await buildOperatorRuntimePorts()[catalogProjectionRuntimePort.id]) as {
      createRuntime(bindings: unknown): unknown
    }
    const bindings = { TYPESENSE_HOST: "http://localhost:8108" }

    expect(provider.createRuntime(bindings)).toBe(provider.createRuntime(bindings))
  })

  it("does not lower or require Catalog subscriber ports when Catalog is deselected", async () => {
    const runtime = createGeneratedGraphRuntime()
    const ports = Object.fromEntries(
      Object.entries(buildOperatorRuntimePorts(new WorkflowRunnerRegistry())).filter(
        ([id]) =>
          id !== catalogProjectionRuntimePort.id && id !== catalogBookingSnapshotRuntimePort.id,
      ),
    )
    const composed = await composeVoyantGraphRuntime({
      runtime: {
        ...runtime,
        modules: runtime.modules.filter((unit) => unit.id !== "@voyant-travel/catalog"),
      },
      capabilities: buildOperatorProviders(),
      ports,
    })

    expect(composed.modules.some((module) => module.module.name === "catalog.graph-runtime")).toBe(
      false,
    )
  })
})
