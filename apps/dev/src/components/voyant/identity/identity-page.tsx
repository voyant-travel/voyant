import { useNavigate } from "@tanstack/react-router"
import { EntityRefPicker } from "@voyantjs/identity-ui"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@voyantjs/ui/components/tabs"
import { IdCard } from "lucide-react"
import { AddressesTab } from "./addresses-tab"
import { ContactPointsTab } from "./contact-points-tab"
import { NamedContactsTab } from "./named-contacts-tab"

type IdentityTab = "contact-points" | "addresses" | "named-contacts"

type Props = {
  entityType: string
  entityId: string
  tab?: IdentityTab
}

export function IdentityPage({ entityType, entityId, tab = "contact-points" }: Props) {
  const navigate = useNavigate({ from: "/identity/" })
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
        <IdCard className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-2xl font-bold tracking-tight">Identity</h1>
      </div>

      <p className="max-w-2xl text-sm text-muted-foreground">
        Manage contact points, addresses and named contacts attached to a selected entity.
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
            Choose an entity above to browse its identity records.
          </p>
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
            <TabsTrigger value="contact-points">Contact Points</TabsTrigger>
            <TabsTrigger value="addresses">Addresses</TabsTrigger>
            <TabsTrigger value="named-contacts">Named Contacts</TabsTrigger>
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
