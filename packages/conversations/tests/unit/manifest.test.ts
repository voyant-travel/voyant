import { staffDirectoryRuntimePort } from "@voyant-travel/auth/staff-directory-runtime-port"
import { describe, expect, it } from "vitest"
import { conversationsVoyantModule } from "../../src/voyant.js"

describe("Conversations manifest", () => {
  it("owns the durable change event consumed by Realtime", () => {
    expect(conversationsVoyantModule.events).toContainEqual(
      expect.objectContaining({
        id: "@voyant-travel/conversations#event.conversation-changed",
        eventType: "conversation.changed",
      }),
    )
  })

  it("requires the Auth-owned active staff directory", () => {
    expect(conversationsVoyantModule.runtimePorts).toContainEqual({
      id: staffDirectoryRuntimePort.id,
    })
  })
})
