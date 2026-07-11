import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { AccessCatalog } from "@voyant-travel/types/api-keys"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { ServiceApiKeysPage } from "./components/service-api-keys-page.js"
import { VoyantAuthProvider, type VoyantFetcher } from "./index.js"

const selectedCatalog: AccessCatalog = {
  resources: [
    {
      id: "bookings",
      unitId: "@voyant-travel/bookings",
      resource: "bookings",
      label: "Selected Bookings",
      description: "Selected booking permissions.",
      wildcard: "allow",
      actions: [{ action: "read", label: "Selected read", description: "Read bookings." }],
    },
  ],
  presets: [],
}

describe("ServiceApiKeysPage access catalog", () => {
  it("renders selected descriptors instead of the legacy resource descriptor", () => {
    const fetcher: VoyantFetcher = async () => new Response(null, { status: 204 })
    const html = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <VoyantAuthProvider baseUrl="https://operator.example/api" fetcher={fetcher}>
          <ServiceApiKeysPage accessCatalog={selectedCatalog} />
        </VoyantAuthProvider>
      </QueryClientProvider>,
    )

    expect(html).toContain("Selected Bookings")
    expect(html).toContain("Selected read")
    expect(html).not.toContain("Cancel bookings")
  })
})
