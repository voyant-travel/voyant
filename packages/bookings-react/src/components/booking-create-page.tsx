"use client"

import { useBookingsUiMessagesOrDefault } from "../i18n/provider.js"
import type { BookingRecord } from "../index.js"
import { BookingCreateForm } from "./booking-create-sheet.js"

export interface BookingCreatePageProps {
  onCreated?: (booking: BookingRecord) => void
  onCancel?: () => void
  /** When provided, pre-selects this product and hides the product picker. */
  defaultProductId?: string
  /** When provided, pre-selects and locks the departure slot. */
  defaultSlotId?: string
}

/**
 * Full-page booking create surface for route-based booking creation.
 */
export function BookingCreatePage({
  onCreated,
  onCancel,
  defaultProductId,
  defaultSlotId,
}: BookingCreatePageProps) {
  const messages = useBookingsUiMessagesOrDefault()

  return (
    <main className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
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
        />
      </section>
    </main>
  )
}
