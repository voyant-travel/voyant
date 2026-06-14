"use client"

import { useAdminNavigate } from "@voyant-travel/admin"
import * as React from "react"

/**
 * Legacy alias: `/bookings/compose` → the trips. The composer used
 * to live here; it moved under the trips area, and this packaged page keeps
 * the old URL working by forwarding to the `trip.create` destination (the
 * host resolves it to its composer route). `replace` keeps route-redirect
 * history semantics — the alias never lands in history.
 */
export default function BookingComposePage() {
  const navigate = useAdminNavigate()

  React.useEffect(() => {
    navigate("trip.create", {}, { replace: true })
  }, [navigate])

  return null
}
