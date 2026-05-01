"use client"

import { useNavigate } from "@tanstack/react-router"
import { CatalogSearchPage, type CatalogSearchTab } from "@voyantjs/catalog-ui"
import { ExtraCatalogCard } from "@voyantjs/extras-ui/components/extra-catalog-card"
import { ProductCatalogCard } from "@voyantjs/products-ui/components/product-catalog-card"

export function CatalogPage() {
  const navigate = useNavigate()

  const tabs: CatalogSearchTab[] = [
    {
      id: "products",
      label: "Products",
      vertical: "products",
      renderCard: (hit) => (
        <ProductCatalogCard
          hit={hit}
          onClick={() => navigate({ to: "/products/$id", params: { id: hit.id } })}
        />
      ),
      filterFields: [
        { field: "status", label: "Status" },
        { field: "bookingMode", label: "Booking mode" },
        { field: "productTypeId", label: "Type" },
      ],
    },
    {
      id: "extras",
      label: "Extras",
      vertical: "extras",
      renderCard: (hit) => <ExtraCatalogCard hit={hit} />,
      filterFields: [
        { field: "status", label: "Status" },
        { field: "category", label: "Category" },
      ],
    },
  ]

  return (
    <div className="container mx-auto p-6">
      <CatalogSearchPage
        tabs={tabs}
        title={
          <div>
            <h1 className="font-semibold text-2xl">Catalog</h1>
            <p className="text-muted-foreground text-sm">
              Search across every catalog vertical from one place.
            </p>
          </div>
        }
        searchPlaceholder="Search products, extras…"
      />
    </div>
  )
}
