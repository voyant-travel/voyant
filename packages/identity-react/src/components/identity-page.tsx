"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@voyant-travel/ui/components/tabs"
import { IdCard } from "lucide-react"
import { useState } from "react"
import { useIdentityUiMessagesOrDefault } from "../i18n/index.js"
import { EntityRefPicker } from "./entity-ref-picker.js"
import { AddressesTab, ContactPointsTab, NamedContactsTab } from "./identity-entity-tabs.js"

export type IdentityTab = "contact-points" | "addresses" | "named-contacts"

export interface IdentityPageProps {
  entityType?: string
  entityId?: string
  tab?: IdentityTab
  onScopeChange?: (scope: { entityType: string; entityId: string }) => void
  onTabChange?: (tab: IdentityTab) => void
}

export function IdentityPage({
  entityType,
  entityId,
  tab,
  onScopeChange,
  onTabChange,
}: IdentityPageProps = {}) {
  const messages = useIdentityUiMessagesOrDefault()
  const pageMessages = messages.identityPage
  const [innerEntityType, setInnerEntityType] = useState(entityType ?? "")
  const [innerEntityId, setInnerEntityId] = useState(entityId ?? "")
  const [innerTab, setInnerTab] = useState<IdentityTab>(tab ?? "contact-points")
  const activeEntityType = entityType ?? innerEntityType
  const activeEntityId = entityId ?? innerEntityId
  const activeTab = tab ?? innerTab
  const scopeReady = activeEntityType.trim().length > 0 && activeEntityId.trim().length > 0

  const updateScope = (next: { entityType?: string; entityId?: string }) => {
    const nextEntityType = next.entityType ?? activeEntityType
    const nextEntityId = next.entityId ?? activeEntityId
    if (entityType === undefined) setInnerEntityType(nextEntityType)
    if (entityId === undefined) setInnerEntityId(nextEntityId)
    onScopeChange?.({ entityType: nextEntityType, entityId: nextEntityId })
  }

  const updateTab = (next: IdentityTab) => {
    if (tab === undefined) setInnerTab(next)
    onTabChange?.(next)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <IdCard className="size-5 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-2xl font-bold tracking-tight">{pageMessages.title}</h1>
      </div>

      <p className="max-w-2xl text-sm text-muted-foreground">{pageMessages.description}</p>

      <EntityRefPicker
        entityType={activeEntityType}
        entityId={activeEntityId}
        onChange={updateScope}
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
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">{pageMessages.emptyScope}</p>
        </div>
      ) : (
        <Tabs
          value={activeTab}
          onValueChange={(value) => updateTab(value as IdentityTab)}
          className="w-full"
        >
          <TabsList>
            <TabsTrigger value="contact-points">{pageMessages.tabs.contactPoints}</TabsTrigger>
            <TabsTrigger value="addresses">{pageMessages.tabs.addresses}</TabsTrigger>
            <TabsTrigger value="named-contacts">{pageMessages.tabs.namedContacts}</TabsTrigger>
          </TabsList>
          <TabsContent value="contact-points" className="mt-4">
            <ContactPointsTab entityType={activeEntityType} entityId={activeEntityId} />
          </TabsContent>
          <TabsContent value="addresses" className="mt-4">
            <AddressesTab entityType={activeEntityType} entityId={activeEntityId} />
          </TabsContent>
          <TabsContent value="named-contacts" className="mt-4">
            <NamedContactsTab entityType={activeEntityType} entityId={activeEntityId} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
