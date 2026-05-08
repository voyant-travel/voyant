import { createFileRoute, Navigate } from "@tanstack/react-router"

export const Route = createFileRoute("/_workspace/finance/")({
  component: () => <Navigate to="/finance/invoices" replace />,
})
