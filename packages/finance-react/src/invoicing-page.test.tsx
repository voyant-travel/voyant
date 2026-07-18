// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { InvoicingPage, type InvoicingPageApi } from "./components/invoicing-page.js"

;(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

type Settings = { invoicingMode: "direct" | "proforma-first" }

function makeApi(
  settings: Settings = { invoicingMode: "proforma-first" },
  overrides: Partial<InvoicingPageApi> = {},
): InvoicingPageApi {
  return {
    get: async <T = unknown>() => ({ data: settings }) as T,
    post: async <T = unknown>() => ({ data: null }) as T,
    patch: async <T = unknown>() => ({ data: null }) as T,
    delete: async <T = unknown>() => undefined as T,
    ...overrides,
  }
}

async function seededClient(settings: Settings) {
  const queryClient = new QueryClient()
  await queryClient.prefetchQuery({
    queryKey: ["booking-tax-settings"],
    queryFn: async () => ({ data: settings }),
  })
  return queryClient
}

describe("InvoicingPage", () => {
  it("renders only the invoicing-mode control (no reference-rate source)", () => {
    const queryClient = new QueryClient()
    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <InvoicingPage api={makeApi()} />
      </QueryClientProvider>,
    )

    expect(html).toContain("Bank transfer invoicing")
    // The FX reference-source setting was removed: managed/adapter-provided FX,
    // not an operator choice. No reference-exchange-rate control remains.
    expect(html).not.toContain("Reference exchange rates")
  })

  describe("shared tax-settings surface", () => {
    let container: HTMLDivElement
    let root: Root

    beforeEach(() => {
      container = document.createElement("div")
      document.body.appendChild(container)
      root = createRoot(container)
    })

    afterEach(() => {
      act(() => root.unmount())
      container.remove()
    })

    it("hydrates the mode select from the fetched settings row", async () => {
      const queryClient = await seededClient({ invoicingMode: "proforma-first" })

      await act(async () => {
        root.render(
          <QueryClientProvider client={queryClient}>
            <InvoicingPage api={makeApi({ invoicingMode: "proforma-first" })} />
          </QueryClientProvider>,
        )
      })

      const modeTrigger = container.querySelector("#invoicing-mode")
      expect(modeTrigger?.textContent).toContain("Proforma first")
      expect(container.querySelector("#fx-reference-source")).toBeNull()
    })

    it("renders the direct selection from the fetched settings row", async () => {
      const queryClient = await seededClient({ invoicingMode: "direct" })

      await act(async () => {
        root.render(
          <QueryClientProvider client={queryClient}>
            <InvoicingPage api={makeApi({ invoicingMode: "direct" })} />
          </QueryClientProvider>,
        )
      })

      const modeTrigger = container.querySelector("#invoicing-mode")
      expect(modeTrigger?.textContent).toContain("Direct invoice")
    })
  })
})
