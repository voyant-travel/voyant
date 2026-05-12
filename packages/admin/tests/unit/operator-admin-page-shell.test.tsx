import { cleanup, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { OperatorAdminPageShell } from "../../src/components/operator-admin-page-shell.js"
import { OperatorAdminWorkspaceLayout } from "../../src/components/operator-admin-sidebar.js"
import { AdminProvider } from "../../src/providers/admin-provider.js"
import { OperatorAdminMessagesProvider } from "../../src/providers/operator-admin-messages.js"

function renderWithAdminProviders(children: ReactNode) {
  return render(
    <AdminProvider themeStorageKey={null}>
      <OperatorAdminMessagesProvider>{children}</OperatorAdminMessagesProvider>
    </AdminProvider>,
  )
}

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("OperatorAdminPageShell", () => {
  it("renders a sticky page header with breadcrumbs, actions, and padded content", () => {
    const { container } = renderWithAdminProviders(
      <OperatorAdminWorkspaceLayout
        currentPath="/bookings"
        navItems={[]}
        showSidebarTrigger={false}
      >
        <OperatorAdminPageShell
          breadcrumbs={<nav aria-label="Breadcrumb">Bookings</nav>}
          actions={<button type="button">New booking</button>}
        >
          <section>Bookings table</section>
        </OperatorAdminPageShell>
      </OperatorAdminWorkspaceLayout>,
    )

    expect(container.querySelectorAll("main[data-slot='sidebar-inset']")).toHaveLength(1)
    expect(container.querySelector("[data-slot='operator-admin-page-shell']")).not.toBeNull()
    expect(
      container.querySelector("[data-slot='operator-admin-page-shell-header']")?.classList,
    ).toContain("sticky")
    expect(screen.getByRole("button", { name: "Toggle sidebar" })).not.toBeNull()
    expect(screen.getByRole("navigation", { name: "Breadcrumb" }).textContent).toBe("Bookings")
    expect(screen.getByRole("button", { name: "New booking" })).not.toBeNull()
    expect(
      container.querySelector("[data-slot='operator-admin-page-shell-content']")?.classList,
    ).toContain("px-4")
    expect(screen.getByText("Bookings table")).not.toBeNull()
  })

  it("can render full-bleed content without duplicating the sidebar trigger", () => {
    const { container } = renderWithAdminProviders(
      <OperatorAdminWorkspaceLayout
        currentPath="/operations"
        navItems={[]}
        showSidebarTrigger={false}
      >
        <OperatorAdminPageShell padded={false} showSidebarTrigger={false}>
          <section>Live operations map</section>
        </OperatorAdminPageShell>
      </OperatorAdminWorkspaceLayout>,
    )

    expect(screen.queryByRole("button", { name: "Toggle sidebar" })).toBeNull()
    expect(
      container.querySelector("[data-slot='operator-admin-page-shell-content']")?.classList,
    ).not.toContain("px-4")
    expect(screen.getByText("Live operations map")).not.toBeNull()
  })
})
