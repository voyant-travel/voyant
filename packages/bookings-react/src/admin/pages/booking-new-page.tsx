"use client"

import { type AdminRoutePageProps, useAdminNavigate } from "@voyant-travel/admin"
// Type-only: binds catalog-react's `AdminDestinations` augmentation
// (`bookingJourney.start`) into this module without pulling its runtime in.
import type {} from "@voyant-travel/catalog-react/admin"
import * as React from "react"

import { ProductPickerSection } from "../../components/product-picker-section.js"
import { useBookingsUiMessagesOrDefault } from "../../i18n/provider.js"
import type { BookingNewSearchParams } from "../index.js"

/**
 * Packaged "New booking" entry page (packaged-admin RFC §4.8): pick an owned
 * product, then route into the unified booking journey so every booking goes
 * through one flow. Owned products come straight off the products table —
 * real names (including non-English), always browsable, with a proper
 * loading state. Supplier-sourced products are booked from the catalog
 * browse/detail pages (which carry the connect provenance), not here.
 *
 * Mounted at `/bookings/new` — a static path, so it outranks the
 * `/bookings/$id` detail route for the `"new"` segment by the router's
 * static-over-dynamic scoring.
 */
export default function BookingNewPage({ search }: AdminRoutePageProps) {
  const { productId, slotId } = search as BookingNewSearchParams
  const navigate = useAdminNavigate()
  const messages = useBookingsUiMessagesOrDefault()

  // Deep-link with a product already chosen (e.g. launched from a product
  // page) → straight into the unified booking journey for that owned
  // product. `replace` keeps route-redirect history semantics.
  React.useEffect(() => {
    if (!productId) return
    navigate(
      "bookingJourney.start",
      {
        entityModule: "products",
        entityId: productId,
        sourceKind: "owned",
        ...(slotId ? { departureId: slotId } : {}),
      },
      { replace: true },
    )
  }, [productId, slotId, navigate])

  if (productId) return null

  return (
    <main className="mx-auto flex w-full max-w-screen-md flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-semibold text-2xl tracking-normal">
          {messages.bookingCreatePage.title}
        </h1>
        <p className="text-muted-foreground text-sm">{messages.bookingCreatePage.description}</p>
      </header>
      <ProductPickerSection
        value={{ productId: "", optionId: null }}
        enabled
        lockProduct={false}
        showOptionPicker={false}
        // Owned pick -> journey with `owned` provenance. Clearing the field
        // yields an empty productId, which we ignore.
        onChange={(value) => {
          if (value.productId) {
            navigate("bookingJourney.start", {
              entityModule: "products",
              entityId: value.productId,
              sourceKind: "owned",
            })
          }
        }}
      />
    </main>
  )
}
