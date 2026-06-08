"use client"

import type { BookingRecord } from "@voyantjs/bookings-react"
import type { ReactNode } from "react"
import { useBookingsUiMessagesOrDefault } from "../i18n/provider.js"
import { BookingCreateForm, type ProductPickerRenderProps } from "./booking-create-sheet.js"

export interface BookingCreatePageProps {
  onCreated?: (booking: BookingRecord) => void
  onCancel?: () => void
  /** When provided, pre-selects this product and hides the product picker. */
  defaultProductId?: string
  /** When provided, pre-selects and locks the departure slot. */
  defaultSlotId?: string
  /**
   * Replace the built-in owned-products picker (e.g. a catalog typeahead
   * spanning owned + supplier-sourced products). See {@link ProductPickerRenderProps}.
   */
  renderProductPicker?: (props: ProductPickerRenderProps) => ReactNode
}

/**
 * Full-page booking create surface for route-based booking creation.
 */
export function BookingCreatePage({
  onCreated,
  onCancel,
  defaultProductId,
  defaultSlotId,
  renderProductPicker,
}: BookingCreatePageProps) {
  const messages = useBookingsUiMessagesOrDefault()

  return (
    <main className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-normal">
          {messages.bookingCreatePage.title}
        </h1>
        <p className="text-sm text-muted-foreground">{messages.bookingCreatePage.description}</p>
      </header>
      <section className="flex flex-col gap-4">
        <BookingCreateForm
          onCreated={onCreated}
          onCancel={onCancel}
          defaultProductId={defaultProductId}
          defaultSlotId={defaultSlotId}
          renderProductPicker={renderProductPicker}
        />
      </section>
    </main>
  )
}
