import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { AdminWidgetSlotRenderer } from "../../src/components/admin-widget-slot.js"
import { defineAdminExtension } from "../../src/extensions.js"
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
})
