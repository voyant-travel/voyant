import { createFileRoute, Navigate } from "@tanstack/react-router"

export const Route = createFileRoute("/_workspace/catalog/")({
  component: () => <Navigate to="/catalog/products" replace />,
})
