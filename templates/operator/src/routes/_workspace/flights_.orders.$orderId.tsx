import { createFileRoute } from "@tanstack/react-router"
import { FlightOrderPage } from "@/components/voyant/flights/flight-order-page"

export const Route = createFileRoute("/_workspace/flights_/orders/$orderId")({
  component: FlightOrderPage,
})
