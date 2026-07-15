import { createContainer, createEventBus } from "@voyant-travel/core"
import { assertPortConforms } from "@voyant-travel/core/project"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { describe, expect, it, vi } from "vitest"

import {
  createNotificationsSubscribersVoyantRuntime,
  createNotificationsVoyantRuntime,
} from "../../src/index.js"
import {
  type NotificationsRuntimeProvider,
  notificationsRuntimePort,
} from "../../src/runtime-port.js"
import { NOTIFICATIONS_SUBSCRIBER_RUNTIME_KEY } from "../../src/subscriber-runtime.js"
import { NOTIFICATION_REMINDER_WORKFLOW_RUNTIME_KEY } from "../../src/workflow-runtime.js"

const workflowRuntime = {
  resolveDb: () => ({}) as PostgresJsDatabase,
  resolveEnv: () => ({}),
  resolveRuntimeOptions: () => ({ providers: [] }),
}

function provider(): NotificationsRuntimeProvider {
  return {
    resolveDb: () => ({}) as PostgresJsDatabase,
    resolveProviders: () => [],
    resolveReminderWorkflowRuntime: () => workflowRuntime,
    autoConfirmAndDispatch: { enabled: true, templateSlug: "booking-confirmation" },
  }
}

function runtimeFactoryContext(value = provider()) {
  return {
    unitId: "@voyant-travel/notifications",
    getUnitProjectConfig: () => undefined,
    hasPort: (port: { id: string }) => port.id === notificationsRuntimePort.id,
    getPort: async () => value,
  } as never
}

describe("Notifications runtime port", () => {
  it("validates the complete Node host contract", async () => {
    await expect(assertPortConforms(notificationsRuntimePort, provider())).resolves.toBeUndefined()
    await expect(
      assertPortConforms(notificationsRuntimePort, {
        resolveDb: vi.fn(),
        resolveProviders: vi.fn(),
      } as never),
    ).rejects.toThrow(/resolveReminderWorkflowRuntime/)
  })

  it("keeps module and selected subscriber services in their owning factories", async () => {
    const container = createContainer()
    const context = { bindings: {}, container, eventBus: createEventBus() }
    const module = await createNotificationsVoyantRuntime(runtimeFactoryContext())
    const extension = await createNotificationsSubscribersVoyantRuntime(runtimeFactoryContext())

    await module.module.bootstrap?.(context)
    expect(container.has(NOTIFICATION_REMINDER_WORKFLOW_RUNTIME_KEY)).toBe(true)
    expect(container.has(NOTIFICATIONS_SUBSCRIBER_RUNTIME_KEY)).toBe(false)

    await extension.extension.bootstrap?.(context)
    expect(container.has(NOTIFICATIONS_SUBSCRIBER_RUNTIME_KEY)).toBe(true)
  })
})
