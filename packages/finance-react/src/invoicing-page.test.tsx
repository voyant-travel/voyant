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

type Settings = { invoicingMode: "direct" | "proforma-first"; fxReferenceSource: "ecb" | "bnr" }

function makeApi(
  settings: Settings = { invoicingMode: "direct", fxReferenceSource: "ecb" },
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
  it("renders both the invoicing-mode and reference-rate settings", () => {
    const queryClient = new QueryClient()
    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <InvoicingPage api={makeApi()} />
      </QueryClientProvider>,
    )

    expect(html).toContain("Invoicing mode")
    // The reference-exchange-rate select lives here, not on the Taxes page.
    expect(html).toContain("Reference exchange rates")
    expect(html).toContain("Recommended for most EU operators")
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

    it("hydrates both selects from the fetched settings row", async () => {
      const queryClient = await seededClient({
        invoicingMode: "proforma-first",
        fxReferenceSource: "bnr",
      })

      await act(async () => {
        root.render(
          <QueryClientProvider client={queryClient}>
            <InvoicingPage
              api={makeApi({ invoicingMode: "proforma-first", fxReferenceSource: "bnr" })}
            />
          </QueryClientProvider>,
        )
      })

      const modeTrigger = container.querySelector("#invoicing-mode")
      const fxTrigger = container.querySelector("#fx-reference-source")
      expect(modeTrigger?.textContent).toContain("Proforma first")
      expect(fxTrigger?.textContent).toContain("National Bank of Romania (BNR)")
    })

    it("defaults both selects to direct/ecb when the settings row is empty", async () => {
      const queryClient = await seededClient({ invoicingMode: "direct", fxReferenceSource: "ecb" })

      await act(async () => {
        root.render(
          <QueryClientProvider client={queryClient}>
            <InvoicingPage api={makeApi()} />
          </QueryClientProvider>,
        )
      })

      const modeTrigger = container.querySelector("#invoicing-mode")
      const fxTrigger = container.querySelector("#fx-reference-source")
      expect(modeTrigger?.textContent).toContain("Direct invoice")
      expect(fxTrigger?.textContent).toContain("European Central Bank (ECB)")
    })
  })
})
