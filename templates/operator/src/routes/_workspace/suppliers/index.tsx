import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { SuppliersPage } from "@voyantjs/suppliers-ui"
import { getSuppliersQueryOptions } from "@/components/voyant/suppliers/shared"
import { SuppliersListSkeleton } from "@/components/voyant/suppliers/suppliers-list-skeleton"

export const Route = createFileRoute("/_workspace/suppliers/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(getSuppliersQueryOptions()),
  pendingComponent: SuppliersListSkeleton,
  component: SuppliersRoute,
})

function SuppliersRoute() {
  const navigate = useNavigate()

  return (
    <div className="p-6">
      <SuppliersPage
        onSupplierOpen={(supplier) =>
          void navigate({ to: "/suppliers/$id", params: { id: supplier.id } })
        }
      />
    </div>
  )
}
