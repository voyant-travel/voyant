import { useNavigate } from "@tanstack/react-router"
import { Input, Label } from "@voyantjs/ui/components"
import { Link2 } from "lucide-react"
import { ExternalRefsTab } from "./external-refs-tab"

type Props = {
  entityType: string
  entityId: string
}

export function ExternalRefsPage({ entityType, entityId }: Props) {
  const navigate = useNavigate({ from: "/external-refs/" })
  const scopeReady = entityType.trim().length > 0 && entityId.trim().length > 0

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Link2 className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-2xl font-bold tracking-tight">External References</h1>
      </div>

      <p className="max-w-2xl text-sm text-muted-foreground">
        IDs from third-party systems linked to Voyant entities. Enter the entity type and ID below
        to manage its external references.
      </p>

      <div className="grid max-w-2xl grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label>Entity type</Label>
          <Input
            value={entityType}
            onChange={(event) => {
              const value = event.target.value
              void navigate({
                to: ".",
                replace: true,
                search: (prev) => ({ ...prev, entityType: value || undefined }),
              })
            }}
            placeholder="person, booking, product..."
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Entity ID</Label>
          <Input
            value={entityId}
            onChange={(event) => {
              const value = event.target.value
              void navigate({
                to: ".",
                replace: true,
                search: (prev) => ({ ...prev, entityId: value || undefined }),
              })
            }}
            placeholder="pers_... / book_... / prod_..."
            className="font-mono text-xs"
          />
        </div>
      </div>

      {!scopeReady ? (
        <div className="rounded-md border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Enter an entity type and ID above to browse its external references.
          </p>
        </div>
      ) : (
        <ExternalRefsTab entityType={entityType} entityId={entityId} />
      )}
    </div>
  )
}
