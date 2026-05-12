"use client"

import type { BookingRecord } from "@voyantjs/bookings-react"
import { useBookingsUiMessagesOrDefault } from "../i18n/provider.js"
import { BookingCreateForm } from "./booking-create-dialog.js"

export interface BookingCreatePageProps {
  onCreated?: (booking: BookingRecord) => void
  /** When provided, pre-selects this product and hides the product picker. */
  defaultProductId?: string
}

/**
 * Full-page booking create surface for route-based booking creation.
 */
export function BookingCreatePage({ onCreated, defaultProductId }: BookingCreatePageProps) {
  const messages = useBookingsUiMessagesOrDefault()

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-normal">
          {messages.bookingCreatePage.title}
        </h1>
        <p className="text-sm text-muted-foreground">{messages.bookingCreatePage.description}</p>
      </header>
      <section className="flex flex-col gap-4">
        <BookingCreateForm onCreated={onCreated} defaultProductId={defaultProductId} />
      </section>
    </main>
  )
}
