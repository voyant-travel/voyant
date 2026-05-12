"use client"

import { useNavigate } from "@tanstack/react-router"
import { EntityRefPicker } from "@voyantjs/external-refs-ui"
import { Link2 } from "lucide-react"

import { ExternalRefsTab } from "./external-refs-tab"
import { useRegistryExternalRefsMessagesOrDefault } from "./i18n"

export interface ExternalRefsPageProps {
  entityType: string
  entityId: string
}

export function ExternalRefsPage({ entityType, entityId }: ExternalRefsPageProps) {
  const navigate = useNavigate({ from: "/external-refs/" })
  const pageMessages = useRegistryExternalRefsMessagesOrDefault().externalRefsPage
  const scopeReady = entityType.trim().length > 0 && entityId.trim().length > 0

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Link2 className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-2xl font-bold tracking-tight">{pageMessages.title}</h1>
      </div>

      <p className="max-w-2xl text-sm text-muted-foreground">{pageMessages.description}</p>

      <EntityRefPicker
        entityType={entityType}
        entityId={entityId}
        onChange={(scope) => {
          void navigate({
            to: ".",
            replace: true,
            search: (prev) => ({
              ...prev,
              entityType: scope.entityType || undefined,
              entityId: scope.entityId || undefined,
            }),
          })
        }}
        messages={{
          entityTypeLabel: pageMessages.fields.entityType,
          entityLabel: pageMessages.fields.entity,
          customEntityTypeLabel: pageMessages.fields.customEntityType,
          typePlaceholder: pageMessages.placeholders.entityType,
          entityPlaceholder: pageMessages.placeholders.entity,
          entityTypeLabels: pageMessages.entityTypeLabels,
        }}
      />

      {!scopeReady ? (
        <div className="rounded-md border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">{pageMessages.emptyScope}</p>
        </div>
      ) : (
        <ExternalRefsTab entityType={entityType} entityId={entityId} />
      )}
    </div>
  )
}
