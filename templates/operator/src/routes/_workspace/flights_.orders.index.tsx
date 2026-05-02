import { createFileRoute } from "@tanstack/react-router"
import { FlightOrdersPage } from "@/components/voyant/flights/flight-orders-page"

export const Route = createFileRoute("/_workspace/flights_/orders/")({
  component: FlightOrdersPage,
})
