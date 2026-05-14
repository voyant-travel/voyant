import { createContainer, createEventBus } from "@voyantjs/core"
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
})
