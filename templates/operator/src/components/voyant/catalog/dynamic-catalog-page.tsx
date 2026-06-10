"use client"

import { useRouter } from "@tanstack/react-router"
import { DynamicCatalogPage as DynamicCatalogPageUi } from "@voyantjs/catalog-ui"

import { useAdminMessages } from "@/lib/admin-i18n"
import { CatalogVerticalPage } from "./catalog-page"
import { type CatalogSearchParams, openCatalogDetail } from "./catalog-route-state"

/**
 * Operator host for the packaged `DynamicCatalogPage` — supplies the localized
 * header, the router-built detail href (opened in a new tab), and renders the
 * operator's `CatalogVerticalPage` (markets/suppliers/products wiring) as the
 * no-search browse grid.
 */
export function DynamicCatalogPage({
  search,
  onSearchChange,
}: {
  search: CatalogSearchParams
  onSearchChange: (
    updater: (prev: CatalogSearchParams) => CatalogSearchParams,
    replace?: boolean,
  ) => void
}) {
  const router = useRouter()
  const nav = useAdminMessages().nav

  return (
    <DynamicCatalogPageUi
      search={search}
      onSearchChange={onSearchChange}
      productsLabel={nav.catalogProducts}
      productsTagline={nav.catalogProductsTagline}
      buildDetailHref={(productId, { adults, nights }) =>
        router.buildLocation({
          to: "/catalog/products/$productId",
          params: { productId },
          search: { adults, nights },
        }).href
      }
      renderBrowseGrid={({ lockedFacets }) => (
        <CatalogVerticalPage
          vertical="products"
          search={search}
          onSearchChange={onSearchChange}
          embedded
          lockedFacets={lockedFacets}
          onOpenDetail={(hit) => openCatalogDetail("products", hit.id)}
        />
      )}
    />
  )
}
