"use client"

import { useNavigate } from "@tanstack/react-router"
import { EntityRefPicker } from "@voyantjs/identity-ui"
import { IdCard } from "lucide-react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AddressesTab } from "./addresses-tab"
import { ContactPointsTab } from "./contact-points-tab"
import { useRegistryIdentityMessagesOrDefault } from "./i18n"
import { NamedContactsTab } from "./named-contacts-tab"

type IdentityTab = "contact-points" | "addresses" | "named-contacts"

export interface IdentityPageProps {
  entityType: string
  entityId: string
  tab?: IdentityTab
}

export function IdentityPage({ entityType, entityId, tab = "contact-points" }: IdentityPageProps) {
  const navigate = useNavigate({ from: "/identity/" })
  const pageMessages = useRegistryIdentityMessagesOrDefault().page
  const scopeReady = entityType.trim().length > 0 && entityId.trim().length > 0

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <IdCard className="h-5 w-5 text-muted-foreground" />
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
        <Tabs
          value={tab}
          onValueChange={(value) => {
            void navigate({
              to: ".",
              replace: true,
              search: (prev) => ({ ...prev, tab: value as IdentityTab }),
            })
          }}
          className="w-full"
        >
          <TabsList>
            <TabsTrigger value="contact-points">{pageMessages.tabs.contactPoints}</TabsTrigger>
            <TabsTrigger value="addresses">{pageMessages.tabs.addresses}</TabsTrigger>
            <TabsTrigger value="named-contacts">{pageMessages.tabs.namedContacts}</TabsTrigger>
          </TabsList>
          <TabsContent value="contact-points" className="mt-4">
            <ContactPointsTab entityType={entityType} entityId={entityId} />
          </TabsContent>
          <TabsContent value="addresses" className="mt-4">
            <AddressesTab entityType={entityType} entityId={entityId} />
          </TabsContent>
          <TabsContent value="named-contacts" className="mt-4">
            <NamedContactsTab entityType={entityType} entityId={entityId} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
