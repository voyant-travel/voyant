import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { useBookingsUiMessagesOrDefault } from "@voyantjs/bookings-react/i18n"
import { lazy, Suspense } from "react"
import { z } from "zod"

const CatalogProductPicker = lazy(() =>
  import("@/components/voyant/catalog/catalog-product-picker").then((module) => ({
    default: module.CatalogProductPicker,
  })),
)

const newBookingSearchSchema = z.object({
  productId: z.string().optional(),
  slotId: z.string().optional(),
})

// App-custom "New booking" entry (the booking DETAIL page is package-delivered
// via the code-assembled admin route tree; this static route wins over the
// grafted `/bookings/$id` param route). Pick an owned product, then route into
// the unified booking journey so every booking goes through one flow.
export const Route = createFileRoute("/_workspace/bookings/new")({
  validateSearch: newBookingSearchSchema,
  // Deep-link with a product already chosen (e.g. launched from a product
  // page) → straight into the unified booking journey for that owned product.
  beforeLoad: ({ search }) => {
    if (search.productId) {
      throw redirect({
        to: "/catalog/journey/$entityModule/$entityId",
        params: { entityModule: "products", entityId: search.productId },
        search: {
          sourceKind: "owned",
          ...(search.slotId ? { departureId: search.slotId } : {}),
        },
      })
    }
  },
  component: NewBookingPicker,
})

function NewBookingPicker() {
  const navigate = useNavigate()
  const messages = useBookingsUiMessagesOrDefault()

  return (
    <main className="mx-auto flex w-full max-w-screen-md flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-semibold text-2xl tracking-normal">
          {messages.bookingCreatePage.title}
        </h1>
        <p className="text-muted-foreground text-sm">{messages.bookingCreatePage.description}</p>
      </header>
      <Suspense fallback={null}>
        <CatalogProductPicker
          value={{ productId: "", optionId: null }}
          enabled
          lockProduct={false}
          // Owned pick -> journey with `owned` provenance. Clearing the field
          // yields an empty productId, which we ignore.
          onChange={(value) => {
            if (value.productId) {
              void navigate({
                to: "/catalog/journey/$entityModule/$entityId",
                params: { entityModule: "products", entityId: value.productId },
                search: { sourceKind: "owned" },
              })
            }
          }}
        />
      </Suspense>
    </main>
  )
}
