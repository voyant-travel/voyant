"use client"

import { useAdminHref, useOperatorAdminMessages } from "@voyantjs/admin"
import { DynamicCatalogPage as DynamicCatalogPageUi } from "../components/dynamic-catalog-page.js"
import type { CatalogSearchParams } from "../index.js"
import { CatalogVerticalHost } from "./catalog-vertical-host.js"
import { openHrefInNewTab } from "./open-in-new-tab.js"

export interface DynamicCatalogHostProps {
  search: CatalogSearchParams
  onSearchChange: (
    updater: (prev: CatalogSearchParams) => CatalogSearchParams,
    replace?: boolean,
  ) => void
}

/**
 * Packaged admin host for `DynamicCatalogPage` — supplies the localized
 * header, the `catalog.detail` destination href (opened in a new tab), and
 * renders `CatalogVerticalHost` (markets/suppliers/products wiring) as the
 * no-search browse grid.
 */
export function DynamicCatalogHost({ search, onSearchChange }: DynamicCatalogHostProps) {
  const resolveHref = useAdminHref()
  const nav = useOperatorAdminMessages().nav

  return (
    <DynamicCatalogPageUi
      search={search}
      onSearchChange={onSearchChange}
      productsLabel={nav.catalogProducts}
      productsTagline={nav.catalogProductsTagline}
      buildDetailHref={(productId, { adults, nights }) =>
        resolveHref("catalog.detail", { surface: "products", id: productId, adults, nights })
      }
      renderBrowseGrid={({ lockedFacets }) => (
        <CatalogVerticalHost
          vertical="products"
          search={search}
          onSearchChange={onSearchChange}
          embedded
          lockedFacets={lockedFacets}
          onOpenDetail={(hit) =>
            openHrefInNewTab(resolveHref("catalog.detail", { surface: "products", id: hit.id }))
          }
        />
      )}
    />
  )
}
