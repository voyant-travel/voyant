import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { TaxesPage, type TaxesPageApi } from "./components/taxes-page.js"

describe("TaxesPage", () => {
  it("renders with a custom API without requiring VoyantFinanceProvider", () => {
    const queryClient = new QueryClient()
    const api: TaxesPageApi = {
      get: async <T = unknown>() => ({ data: [], total: 0 }) as T,
      post: async <T = unknown>() => ({ data: null }) as T,
      patch: async <T = unknown>() => ({ data: null }) as T,
      delete: async <T = unknown>() => undefined as T,
    }

    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <TaxesPage api={api} />
      </QueryClientProvider>,
    )

    expect(html).toContain("Tax Regimes and Classes")
  })
})
