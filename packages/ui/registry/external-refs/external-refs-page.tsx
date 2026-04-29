"use client"

import { useNavigate } from "@tanstack/react-router"
import { Link2 } from "lucide-react"

import { Input, Label } from "@/components/ui"
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

      <div className="grid max-w-2xl grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label>{pageMessages.fields.entityType}</Label>
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
            placeholder={pageMessages.placeholders.entityType}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>{pageMessages.fields.entityId}</Label>
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
            placeholder={pageMessages.placeholders.entityId}
            className="font-mono text-xs"
          />
        </div>
      </div>

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
