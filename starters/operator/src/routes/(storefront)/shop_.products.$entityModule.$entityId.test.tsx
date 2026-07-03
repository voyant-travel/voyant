import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  params: { entityModule: "products", entityId: "prod_1" },
}))

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: unknown) => config,
  useParams: () => mocks.params,
}))

vi.mock("./shop-product-detail-accommodations", () => ({
  AccommodationDetailPage: ({ entityId }: { entityId: string }) => (
    <div data-testid="accommodation-detail">{entityId}</div>
  ),
}))

vi.mock("./shop-product-detail-cruises", () => ({
  CruiseDetailPage: ({ entityId }: { entityId: string }) => (
    <div data-testid="cruise-detail">{entityId}</div>
  ),
}))

vi.mock("./shop-product-detail-products", () => ({
  ProductDetailPageProducts: ({
    entityModule,
    entityId,
  }: {
    entityModule: string
    entityId: string
  }) => (
    <div data-testid="product-detail">
      {entityModule}:{entityId}
    </div>
  ),
}))

import { DetailPage } from "./shop_.products.$entityModule.$entityId"

describe("storefront product detail route", () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    mocks.params = { entityModule: "products", entityId: "prod_1" }
  })

  it("routes owned cruise ids to the cruise detail page", async () => {
    mocks.params = { entityModule: "cruises", entityId: "cru_123" }

    await act(async () => {
      root.render(<DetailPage />)
    })

    expect(host.querySelector("[data-testid='cruise-detail']")?.textContent).toBe("cru_123")
    expect(host.querySelector("[data-testid='product-detail']")).toBeNull()
  })

  it("routes products to the product detail page", async () => {
    mocks.params = { entityModule: "products", entityId: "prod_123" }

    await act(async () => {
      root.render(<DetailPage />)
    })

    expect(host.querySelector("[data-testid='product-detail']")?.textContent).toBe(
      "products:prod_123",
    )
  })
})
