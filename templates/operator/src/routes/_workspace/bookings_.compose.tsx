import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_workspace/bookings_/compose")({
  beforeLoad: () => {
    throw redirect({ to: "/trips/$id", params: { id: "new" } })
  },
})
