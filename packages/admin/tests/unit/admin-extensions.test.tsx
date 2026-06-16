import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { AdminWidgetSlotRenderer } from "../../src/components/admin-widget-slot.js"
import { adminWorkspaceHeaderActionsSlot, defineAdminExtension } from "../../src/extensions.js"
import { AdminExtensionsProvider } from "../../src/providers/admin-extensions.js"

describe("admin extensions context", () => {
  it("renders widget slots from the provider extensions", () => {
    const extension = defineAdminExtension({
      id: "dashboard-test",
      widgets: [
        {
          id: "dashboard-test-widget",
          slot: "dashboard.header",
          component: () => <div>Dashboard widget</div>,
        },
      ],
    })

    render(
      <AdminExtensionsProvider extensions={[extension]}>
        <AdminWidgetSlotRenderer slot="dashboard.header" />
      </AdminExtensionsProvider>,
    )

    expect(screen.getByText("Dashboard widget")).not.toBeNull()
  })

  it("renders workspace header action widgets from the shared chrome slot", () => {
    const extension = defineAdminExtension({
      id: "assistant-launcher",
      widgets: [
        {
          id: "assistant-launcher-action",
          slot: adminWorkspaceHeaderActionsSlot,
          component: () => <button type="button">Ask assistant</button>,
        },
      ],
    })

    render(
      <AdminExtensionsProvider extensions={[extension]}>
        <AdminWidgetSlotRenderer slot={adminWorkspaceHeaderActionsSlot} />
      </AdminExtensionsProvider>,
    )

    expect(screen.getByRole("button", { name: "Ask assistant" })).not.toBeNull()
  })
})
