import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { SuppliersPage } from "@voyantjs/suppliers-ui"
import { getSuppliersQueryOptions } from "@/components/voyant/suppliers/shared"
import { SuppliersListSkeleton } from "@/components/voyant/suppliers/suppliers-list-skeleton"

export const Route = createFileRoute("/_workspace/suppliers/")({
  ssr: "data-only",
  loader: ({ context }) => context.queryClient.ensureQueryData(getSuppliersQueryOptions()),
  pendingComponent: SuppliersListSkeleton,
  component: SuppliersRoute,
})

function SuppliersRoute() {
  const navigate = useNavigate()

  return (
    <SuppliersPage
      onSupplierOpen={(supplier) =>
        void navigate({ to: "/suppliers/$id", params: { id: supplier.id } })
      }
    />
  )
}
