import { createContainer, createEventBus } from "@voyant-travel/core"
import { describe, expect, it, vi } from "vitest"

import { CONTRACTS_ROUTE_RUNTIME_CONTAINER_KEY, createLegalHonoModule } from "../../src/index.js"

describe("createLegalHonoModule", () => {
  it("registers contracts route runtime during bootstrap", () => {
    const generator = vi.fn()
    const eventBus = createEventBus()
    const resolveDocumentGenerator = vi.fn(() => generator)
    const resolveEventBus = vi.fn(() => eventBus)
    const container = createContainer()
    const bindings = { PDF_TOKEN: "token" }

    const module = createLegalHonoModule({
      resolveDocumentGenerator,
      resolveEventBus,
    }).module

    module.bootstrap?.({ bindings, container })

    const runtime = container.resolve(CONTRACTS_ROUTE_RUNTIME_CONTAINER_KEY)

    expect(resolveDocumentGenerator).toHaveBeenCalledTimes(1)
    expect(resolveEventBus).toHaveBeenCalledTimes(1)
    expect(runtime?.documentGenerator).toBe(generator)
    expect(runtime?.eventBus).toBe(eventBus)
  })

  it("uses the module event bus when no route event bus is configured", () => {
    const eventBus = createEventBus()
    const container = createContainer()

    const module = createLegalHonoModule().module

    module.bootstrap?.({ bindings: {}, container, eventBus })

    const runtime = container.resolve(CONTRACTS_ROUTE_RUNTIME_CONTAINER_KEY)

    expect(runtime?.eventBus).toBe(eventBus)
  })

  it("leaves booking subscriber registration to selected-graph composition", async () => {
    const eventBus = createEventBus()
    const subscribe = vi.spyOn(eventBus, "subscribe")
    const container = createContainer()
    const module = createLegalHonoModule({
      resolveDb: () => ({}) as never,
      resolveDocumentGenerator: () => vi.fn(),
      autoGenerateContractOnConfirmed: {
        enabled: true,
        templateSlug: "customer-sales-agreement",
      },
    }).module

    await module.bootstrap?.({ bindings: {}, container, eventBus })

    expect(subscribe).not.toHaveBeenCalled()
  })
})
