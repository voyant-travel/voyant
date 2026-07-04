"use client"

import { type AdminRoutePageProps, useAdminNavigate } from "@voyant-travel/admin"
import type { FlightOrder } from "@voyant-travel/flights/contract/types"
import { Button } from "@voyant-travel/ui/components/button"
import { Skeleton } from "@voyant-travel/ui/components/skeleton"
import { ChevronLeft } from "lucide-react"

import { FlightOrderConfirmation } from "../../components/flight-order-confirmation.js"
import {
  useAirlines,
  useAirports,
  useFlightOrder,
  useFlightOrderCancel,
  useFlightOrderTicket,
} from "../../hooks/index.js"
import { useFlightsUiMessagesOrDefault } from "../../i18n/index.js"

/**
 * Packaged route page for a single flight order (`/flights/orders/$orderId`).
 * Fetches the persisted order, renders the shared {@link FlightOrderConfirmation}
 * surface, and wires the ticketing-deadline workflow: **Issue tickets** (held
 * orders, before the deadline) and **Cancel** — both connector operations
 * modeled on the flight adapter.
 */
// fallow-ignore-next-line unused-export
export default function FlightOrderDetailPage({ params }: AdminRoutePageProps) {
  const navigateTo = useAdminNavigate()
  const messages = useFlightsUiMessagesOrDefault()
  const t = messages.flightOrdersPage
  const orderId = params.orderId ?? ""

  const orderQuery = useFlightOrder(orderId)
  const cancelMutation = useFlightOrderCancel()
  const ticketMutation = useFlightOrderTicket()

  const airlinesQuery = useAirlines()
  const airportsQuery = useAirports({ limit: 200 })
  const carrierName = (code: string) =>
    airlinesQuery.data?.data.find((airline) => airline.iataCode === code)?.name
  const airportName = (code: string) => {
    const airport = airportsQuery.data?.data.find((item) => item.iataCode === code)
    return airport ? `${airport.city} (${airport.iataCode})` : undefined
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-6 lg:px-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="font-semibold text-2xl">{t.detailTitle}</h1>
        <Button variant="ghost" onClick={() => navigateTo("flight.orders", {})}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          {t.backToOrders}
        </Button>
      </header>

      {orderQuery.isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : orderQuery.isError || !orderQuery.data ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed p-10 text-center text-muted-foreground">
          <span>{t.loadFailed}</span>
          <Button variant="outline" size="sm" onClick={() => orderQuery.refetch()}>
            {t.retry}
          </Button>
        </div>
      ) : (
        <FlightOrderConfirmation
          order={orderQuery.data.order as FlightOrder}
          carrierName={carrierName}
          airportName={airportName}
          onTicket={(order) => ticketMutation.mutate(order.orderId)}
          ticketLoading={ticketMutation.isPending}
          onCancel={(order) => cancelMutation.mutate({ orderId: order.orderId })}
          cancelLoading={cancelMutation.isPending}
        />
      )}
    </div>
  )
}
