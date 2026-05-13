import { useNavigate } from "@tanstack/react-router"
import { EntityRefPicker } from "@voyantjs/external-refs-ui"
import { Link2 } from "lucide-react"
import { ExternalRefsTab } from "./external-refs-tab"

type Props = {
  entityType: string
  entityId: string
}

export function ExternalRefsPage({ entityType, entityId }: Props) {
  const navigate = useNavigate({ from: "/external-refs/" })
  const scopeReady = entityType.trim().length > 0 && entityId.trim().length > 0
  const updateScope = (next: { entityType: string; entityId: string }) => {
    void navigate({
      to: ".",
      replace: true,
      search: (prev) => ({
        ...prev,
        entityType: next.entityType || undefined,
        entityId: next.entityId || undefined,
      }),
    })
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Link2 className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-2xl font-bold tracking-tight">External References</h1>
      </div>

      <p className="max-w-2xl text-sm text-muted-foreground">
        References from third-party systems linked to Voyant entities. Choose an entity below to
        manage its external references.
      </p>

      <EntityRefPicker
        entityType={entityType}
        entityId={entityId}
        onChange={updateScope}
        messages={{
          entityTypeLabel: "Entity type",
          entityLabel: "Entity",
          customEntityTypeLabel: "Custom",
          typePlaceholder: "Choose a type",
          entityPlaceholder: "Search or paste a reference",
          entityTypeLabels: {
            person: "Person",
            organization: "Organization",
            supplier: "Supplier",
            booking: "Booking",
            product: "Product",
          },
        }}
      />

      {!scopeReady ? (
        <div className="rounded-md border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Choose an entity above to browse its external references.
          </p>
        </div>
      ) : (
        <ExternalRefsTab entityType={entityType} entityId={entityId} />
      )}
    </div>
  )
}
