import { cleanup, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  DefaultOperatorAdminBrand,
  OperatorAdminWorkspaceLayout,
} from "../../src/components/operator-admin-sidebar.js"
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

describe("OperatorAdminWorkspaceLayout", () => {
  it("wraps page content in SidebarInset and renders a sidebar trigger header", () => {
    const { container } = renderWithAdminProviders(
      <OperatorAdminWorkspaceLayout currentPath="/" navItems={[]}>
        <section>Dashboard content</section>
      </OperatorAdminWorkspaceLayout>,
    )

    expect(container.querySelector("main[data-slot='sidebar-inset']")).not.toBeNull()
    expect(screen.getByRole("button", { name: "Toggle sidebar" })).not.toBeNull()
    expect(screen.getByText("Dashboard content")).not.toBeNull()
  })

  it("passes inset variant, side, and default open state into the sidebar primitives", () => {
    const { container } = renderWithAdminProviders(
      <OperatorAdminWorkspaceLayout
        currentPath="/"
        defaultOpen={false}
        navItems={[]}
        side="right"
        variant="inset"
      >
        <section>Dashboard content</section>
      </OperatorAdminWorkspaceLayout>,
    )

    const sidebar = container.querySelector("[data-slot='sidebar']")

    expect(sidebar?.getAttribute("data-variant")).toBe("inset")
    expect(sidebar?.getAttribute("data-side")).toBe("right")
    expect(sidebar?.getAttribute("data-state")).toBe("collapsed")
  })

  it("renders right-sided sidebars after the inset so the reserved gap is on the right", () => {
    const { container } = renderWithAdminProviders(
      <OperatorAdminWorkspaceLayout currentPath="/" navItems={[]} side="right">
        <section>Dashboard content</section>
      </OperatorAdminWorkspaceLayout>,
    )

    const wrapper = container.querySelector("[data-slot='sidebar-wrapper']")
    const directSlots = Array.from(wrapper?.children ?? []).map((element) =>
      element.getAttribute("data-slot"),
    )

    expect(directSlots).toEqual(["sidebar-inset", "sidebar"])
  })
})

describe("DefaultOperatorAdminBrand", () => {
  it("uses the sidebar menu button pattern", () => {
    const { container } = renderWithAdminProviders(
      <OperatorAdminWorkspaceLayout
        currentPath="/"
        brand={<DefaultOperatorAdminBrand />}
        navItems={[]}
      >
        <section>Dashboard content</section>
      </OperatorAdminWorkspaceLayout>,
    )

    expect(container.querySelector("[data-slot='sidebar-menu']")).not.toBeNull()
    expect(container.querySelector("[data-slot='sidebar-menu-item']")).not.toBeNull()
    expect(container.querySelector("[data-slot='sidebar-menu-button']")).not.toBeNull()
    expect(screen.getByRole("link", { name: "Voyant" }).getAttribute("href")).toBe("/")
    expect(container.querySelector("[data-slot='voyant-mark']")).not.toBeNull()
    expect(container.querySelector("[data-slot='voyant-wordmark']")).not.toBeNull()
  })

  it("uses the workspace link component for the default brand link", () => {
    const AdminLink = ({
      "aria-label": ariaLabel,
      children,
      href,
      target,
      ...props
    }: {
      "aria-label"?: string
      children: ReactNode
      href: string
      target?: "_self" | "_blank"
    } & Omit<React.ComponentPropsWithoutRef<"a">, "href" | "target">) => (
      <a aria-label={ariaLabel} data-router-link="true" href={href} target={target} {...props}>
        {children}
      </a>
    )

    renderWithAdminProviders(
      <OperatorAdminWorkspaceLayout currentPath="/" linkComponent={AdminLink} navItems={[]}>
        <section>Dashboard content</section>
      </OperatorAdminWorkspaceLayout>,
    )

    expect(screen.getByRole("link", { name: "Voyant" }).getAttribute("data-router-link")).toBe(
      "true",
    )
  })
})
