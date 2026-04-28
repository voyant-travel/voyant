import { Link } from "@tanstack/react-router"
import { useFacility } from "@voyantjs/facilities-react"
import { Badge } from "@voyantjs/ui/components"
import { buttonVariants } from "@voyantjs/ui/components/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@voyantjs/ui/components/tabs"
import { ArrowLeft, Hotel, Loader2 } from "lucide-react"
import { AddressesTab } from "@/components/voyant/identity/addresses-tab"
import { ContactPointsTab } from "@/components/voyant/identity/contact-points-tab"
import { NamedContactsTab } from "@/components/voyant/identity/named-contacts-tab"
import { FacilityFeaturesTab } from "./facility-features-tab"
import { OperationSchedulesTab } from "./operation-schedules-tab"
import { PropertyTab } from "./property-tab"

type Props = { id: string }

export function FacilityDetailPage({ id }: Props) {
  const { data: facility, isPending } = useFacility(id)

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!facility) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Facility not found.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Link to="/facilities" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Link>
        <Hotel className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-2xl font-bold tracking-tight">{facility.name}</h1>
        <Badge variant="outline" className="capitalize">
          {facility.kind.replace(/_/g, " ")}
        </Badge>
        <Badge variant={facility.status === "active" ? "default" : "outline"}>
          {facility.status}
        </Badge>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="property">Property</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="schedules">Schedules</TabsTrigger>
          <TabsTrigger value="contact-points">Contact Points</TabsTrigger>
          <TabsTrigger value="addresses">Addresses</TabsTrigger>
          <TabsTrigger value="named-contacts">Named Contacts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid max-w-2xl grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Code</p>
              <p className="font-mono text-sm">{facility.code ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Timezone</p>
              <p className="text-sm">{facility.timezone ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">City</p>
              <p className="text-sm">{facility.city ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Country</p>
              <p className="text-sm">{facility.country ?? "-"}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground">Description</p>
              <p className="text-sm">{facility.description ?? "-"}</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="property" className="mt-4">
          <PropertyTab facilityId={facility.id} />
        </TabsContent>

        <TabsContent value="features" className="mt-4">
          <FacilityFeaturesTab facilityId={facility.id} />
        </TabsContent>

        <TabsContent value="schedules" className="mt-4">
          <OperationSchedulesTab facilityId={facility.id} />
        </TabsContent>

        <TabsContent value="contact-points" className="mt-4">
          <ContactPointsTab entityType="facility" entityId={facility.id} />
        </TabsContent>

        <TabsContent value="addresses" className="mt-4">
          <AddressesTab entityType="facility" entityId={facility.id} />
        </TabsContent>

        <TabsContent value="named-contacts" className="mt-4">
          <NamedContactsTab entityType="facility" entityId={facility.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
