import { cleanup, render, waitFor } from "@testing-library/react"
import { type ReactNode, useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  AdminPageHead,
  AdminPageHeadProvider,
  useAdminPageHead,
} from "../../src/components/admin-page-head.js"
import { AdminProvider } from "../../src/providers/admin-provider.js"

function renderWithAdminProvider(children: ReactNode) {
  return render(<AdminProvider themeStorageKey={null}>{children}</AdminProvider>)
}

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeEventListener: vi.fn(),
    addEventListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
  document.documentElement.lang = ""
  document.title = ""
  document.head.querySelector('meta[name="description"]')?.remove()
  document.head.querySelector('meta[property="og:title"]')?.remove()
  document.head.querySelector('meta[property="og:description"]')?.remove()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("AdminPageHead", () => {
  it("updates document title, html lang, description, and Open Graph tags", async () => {
    renderWithAdminProvider(
      <AdminPageHead brand="Acme" description="Operator booking queue" title="Bookings" />,
    )

    await waitFor(() => expect(document.title).toBe("Bookings · Acme"))
    expect(document.documentElement.lang).toBe("en")
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute("content")).toBe(
      "Operator booking queue",
    )
    expect(document.head.querySelector('meta[property="og:title"]')?.getAttribute("content")).toBe(
      "Bookings · Acme",
    )
    expect(
      document.head.querySelector('meta[property="og:description"]')?.getAttribute("content"),
    ).toBe("Operator booking queue")
  })

  it("lets nested route hooks override provider defaults and restores them on unmount", async () => {
    function DetailHead() {
      useAdminPageHead({ description: "Detailed product view", title: "Danube Cruise" })

      return null
    }

    function Harness() {
      const [showDetail, setShowDetail] = useState(true)

      return (
        <AdminPageHeadProvider baseHead={{ brand: "Acme", title: "Products" }}>
          <button type="button" onClick={() => setShowDetail(false)}>
            Close detail
          </button>
          {showDetail && <DetailHead />}
        </AdminPageHeadProvider>
      )
    }

    const { getByRole } = renderWithAdminProvider(<Harness />)

    await waitFor(() => expect(document.title).toBe("Danube Cruise · Acme"))
    getByRole("button", { name: "Close detail" }).click()
    await waitFor(() => expect(document.title).toBe("Products · Acme"))
  })
})
