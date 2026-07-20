import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { ProductsUiMessagesProvider } from "../i18n/provider.js"
import { VoyantProductsProvider } from "../provider.js"
import { ProductMediaSection } from "./product-media-section.js"

function renderSection(children: React.ReactNode) {
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <VoyantProductsProvider baseUrl="/api" fetcher={async () => new Response("{}")}>
        <ProductsUiMessagesProvider locale="en">{children}</ProductsUiMessagesProvider>
      </VoyantProductsProvider>
    </QueryClientProvider>,
  )
}

describe("ProductMediaSection media-library picker entry point", () => {
  it("renders the choose-from-library action alongside the inline upload", () => {
    const html = renderSection(
      <ProductMediaSection productId="prod_1" uploadMedia={async () => ({ url: "https://x/y" })} />,
    )

    expect(html).toContain("Choose from Media Library")
    expect(html).toContain("Upload")
  })

  it("renders the library action even without an inline upload handler", () => {
    const html = renderSection(<ProductMediaSection productId="prod_1" />)

    expect(html).toContain("Choose from Media Library")
  })
})
