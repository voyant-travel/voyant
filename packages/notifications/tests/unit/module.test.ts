import { createContainer, createEventBus } from "@voyant-travel/core"
import { describe, expect, it, vi } from "vitest"

import {
  createNotificationsHonoModule,
  NOTIFICATIONS_ROUTE_RUNTIME_CONTAINER_KEY,
} from "../../src/index.js"

describe("createNotificationsHonoModule.bootstrap", () => {
  it("registers the resolved route runtime once", async () => {
    const resolveProviders = vi.fn(() => [
      {
        name: "email-provider",
        channels: ["email"],
        send: vi.fn(async () => ({ id: "ntf_123", provider: "email-provider" })),
      },
    ])
    const documentAttachmentResolver = vi.fn(async () => null)
    const eventBus = createEventBus()
    const module = createNotificationsHonoModule({
      resolveProviders,
      documentAttachmentResolver,
      eventBus,
    })
    const container = createContainer()

    await module.module.bootstrap?.({
      bindings: {},
      container,
      eventBus: createEventBus(),
    })

    const runtime = container.resolve<{
      providers: ReadonlyArray<{ name: string }>
      documentAttachmentResolver?: typeof documentAttachmentResolver
      eventBus?: typeof eventBus
    }>(NOTIFICATIONS_ROUTE_RUNTIME_CONTAINER_KEY)

    expect(resolveProviders).toHaveBeenCalledOnce()
    expect(runtime.providers).toHaveLength(1)
    expect(runtime.providers[0]?.name).toBe("email-provider")
    expect(runtime.documentAttachmentResolver).toBe(documentAttachmentResolver)
    expect(runtime.eventBus).toBe(eventBus)
  })
})
