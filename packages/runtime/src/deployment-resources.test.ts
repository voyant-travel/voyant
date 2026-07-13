import type { VoyantRuntimeHostPrimitives } from "@voyant-travel/core"
import { describe, expect, it, vi } from "vitest"

import { createVoyantDeploymentResources } from "./deployment-resources.js"

function primitives(): VoyantRuntimeHostPrimitives {
  return {
    env: () => ({}),
    database: {
      resolve: <TDatabase>() => ({}) as TDatabase,
      fromContext: <TDatabase>() => ({}) as TDatabase,
      transaction: async (_bindings, operation) => operation({}),
    },
    storage: {
      resolve: () => ({}),
      read: async () => null,
      downloadUrl: async () => null,
    },
    events: { deliver: vi.fn(async () => ["queued"]) },
    config: { read: () => undefined },
  }
}

describe("createVoyantDeploymentResources", () => {
  it("lowers the generated runtime ports from the exact injected primitives", () => {
    const hostPrimitives = primitives()
    const createRuntimePorts = vi.fn(() => ({ "example.port": { ready: true } }))

    const resources = createVoyantDeploymentResources({
      primitives: hostPrimitives,
      createRuntimePorts,
    })

    expect(createRuntimePorts).toHaveBeenCalledWith({ primitives: hostPrimitives })
    expect(resources).toMatchObject({
      capabilities: {},
      primitives: hostPrimitives,
      ports: { "example.port": { ready: true } },
    })
  })

  it("delegates outbound webhook delivery to the injected event primitive", async () => {
    const hostPrimitives = primitives()
    const event = { id: "event_1" }
    const bindings = { DATABASE_URL: "postgres://example.invalid/voyant" }
    const resources = createVoyantDeploymentResources({
      primitives: hostPrimitives,
      createRuntimePorts: () => ({}),
      outboundWebhooks: { enqueue: hostPrimitives.events.deliver },
    })

    await expect(resources.outboundWebhooks?.enqueue(event as never, bindings)).resolves.toEqual([
      "queued",
    ])
    expect(hostPrimitives.events.deliver).toHaveBeenCalledWith(event, bindings)
  })

  it("omits outbound webhook composition when no enqueuer is selected", () => {
    const resources = createVoyantDeploymentResources({
      primitives: primitives(),
      createRuntimePorts: () => ({}),
    })

    expect(resources.outboundWebhooks).toBeUndefined()
  })
})
