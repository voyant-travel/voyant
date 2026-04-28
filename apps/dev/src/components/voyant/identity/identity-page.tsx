import { useNavigate } from "@tanstack/react-router"
import { Input, Label } from "@voyantjs/ui/components"
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

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <IdCard className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-2xl font-bold tracking-tight">Identity</h1>
      </div>

      <p className="max-w-2xl text-sm text-muted-foreground">
        Manage contact points, addresses and named contacts attached to any entity.
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
            placeholder="person, organization, supplier..."
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
            placeholder="pers_... / org_... / supp_..."
            className="font-mono text-xs"
          />
        </div>
      </div>

      {!scopeReady ? (
        <div className="rounded-md border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Enter an entity type and ID above to browse its identity records.
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
