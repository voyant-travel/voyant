import { Link } from "@tanstack/react-router"
import { useFacility, useProperty } from "@voyantjs/facilities-react"
import { MaintenanceBlocksTab } from "@voyantjs/hospitality-ui/components/maintenance-blocks-tab"
import { MealPlansTab } from "@voyantjs/hospitality-ui/components/meal-plans-tab"
import { RatePlansTab } from "@voyantjs/hospitality-ui/components/rate-plans-tab"
import { RoomBlocksTab } from "@voyantjs/hospitality-ui/components/room-blocks-tab"
import { RoomInventoryTab } from "@voyantjs/hospitality-ui/components/room-inventory-tab"
import { RoomTypesTab } from "@voyantjs/hospitality-ui/components/room-types-tab"
import { RoomUnitsTab } from "@voyantjs/hospitality-ui/components/room-units-tab"
import { StayRulesTab } from "@voyantjs/hospitality-ui/components/stay-rules-tab"
import { Badge, Button } from "@voyantjs/ui/components"
import { buttonVariants } from "@voyantjs/ui/components/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@voyantjs/ui/components/tabs"
import { ArrowLeft, Building2, Loader2, Pencil } from "lucide-react"
import { useState } from "react"
import { HousekeepingTasksTab } from "@/components/voyant/hospitality/housekeeping-tasks-tab"
import { RatePlanInventoryOverridesTab } from "@/components/voyant/hospitality/rate-plan-inventory-overrides-tab"
import { RatePlanRoomTypesTab } from "@/components/voyant/hospitality/rate-plan-room-types-tab"
import { RoomTypeRatesTab } from "@/components/voyant/hospitality/room-type-rates-tab"
import { StayBookingItemsTab } from "@/components/voyant/hospitality/stay-booking-items-tab"
import { StayFoliosTab } from "@/components/voyant/hospitality/stay-folios-tab"
import { StayOperationsTab } from "@/components/voyant/hospitality/stay-operations-tab"
import { PropertyDialog } from "./property-dialog"

type Props = {
  id: string
}

export function PropertyDetailPage({ id }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const { data: property, isPending, refetch } = useProperty(id)
  const { data: facility } = useFacility(property?.facilityId)

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!property) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Property not found.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Link to="/properties" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Link>
        <Building2 className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-2xl font-bold tracking-tight">
          {facility?.name ?? property.facilityId}
        </h1>
        <Badge variant="outline" className="capitalize">
          {property.propertyType}
        </Badge>
        {facility && (
          <Link
            to="/facilities/$id"
            params={{ id: facility.id }}
            className="text-sm text-muted-foreground hover:underline"
          >
            View facility
          </Link>
        )}
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
            <Pencil className="mr-2 h-3.5 w-3.5" />
            Edit Property
          </Button>
        </div>
      </div>

      <div className="grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">Brand</p>
          <p className="text-sm">{property.brandName ?? "-"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Group</p>
          <p className="text-sm">{property.groupName ?? "-"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Rating</p>
          <p className="font-mono text-sm">
            {property.rating != null
              ? `${property.rating}${property.ratingScale ? ` / ${property.ratingScale}` : ""}`
              : "-"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Check-in / out</p>
          <p className="font-mono text-sm">
            {property.checkInTime ?? "-"} / {property.checkOutTime ?? "-"}
          </p>
        </div>
        {property.policyNotes && (
          <div className="col-span-2">
            <p className="text-xs text-muted-foreground">Policy notes</p>
            <p className="text-sm">{property.policyNotes}</p>
          </div>
        )}
        {property.amenityNotes && (
          <div className="col-span-2">
            <p className="text-xs text-muted-foreground">Amenity notes</p>
            <p className="text-sm">{property.amenityNotes}</p>
          </div>
        )}
      </div>

      <Tabs defaultValue="setup" className="w-full">
        <TabsList>
          <TabsTrigger value="setup">Setup</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="stays">Stays</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
        </TabsList>

        <TabsContent value="setup" className="mt-4">
          <Tabs defaultValue="room-types" className="w-full">
            <TabsList>
              <TabsTrigger value="room-types">Room Types</TabsTrigger>
              <TabsTrigger value="room-units">Room Units</TabsTrigger>
              <TabsTrigger value="meal-plans">Meal Plans</TabsTrigger>
              <TabsTrigger value="rate-plans">Rate Plans</TabsTrigger>
              <TabsTrigger value="rates">Rates</TabsTrigger>
              <TabsTrigger value="stay-rules">Stay Rules</TabsTrigger>
            </TabsList>
            <TabsContent value="room-types" className="mt-4">
              <RoomTypesTab propertyId={id} />
            </TabsContent>
            <TabsContent value="room-units" className="mt-4">
              <RoomUnitsTab propertyId={id} />
            </TabsContent>
            <TabsContent value="meal-plans" className="mt-4">
              <MealPlansTab propertyId={id} />
            </TabsContent>
            <TabsContent value="rate-plans" className="mt-4">
              <RatePlansTab propertyId={id} />
            </TabsContent>
            <TabsContent value="rates" className="mt-4">
              <RoomTypeRatesTab propertyId={id} />
            </TabsContent>
            <TabsContent value="stay-rules" className="mt-4">
              <StayRulesTab propertyId={id} />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="inventory" className="mt-4">
          <Tabs defaultValue="room-inventory" className="w-full">
            <TabsList>
              <TabsTrigger value="room-inventory">Room Inventory</TabsTrigger>
              <TabsTrigger value="rate-plan-room-types">Rate Plan ↔ Room Types</TabsTrigger>
              <TabsTrigger value="rate-plan-overrides">Rate Plan Overrides</TabsTrigger>
              <TabsTrigger value="room-blocks">Room Blocks</TabsTrigger>
              <TabsTrigger value="maintenance-blocks">Maintenance Blocks</TabsTrigger>
            </TabsList>
            <TabsContent value="room-inventory" className="mt-4">
              <RoomInventoryTab propertyId={id} />
            </TabsContent>
            <TabsContent value="rate-plan-room-types" className="mt-4">
              <RatePlanRoomTypesTab propertyId={id} />
            </TabsContent>
            <TabsContent value="rate-plan-overrides" className="mt-4">
              <RatePlanInventoryOverridesTab propertyId={id} />
            </TabsContent>
            <TabsContent value="room-blocks" className="mt-4">
              <RoomBlocksTab propertyId={id} />
            </TabsContent>
            <TabsContent value="maintenance-blocks" className="mt-4">
              <MaintenanceBlocksTab propertyId={id} />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="stays" className="mt-4">
          <Tabs defaultValue="booking-items" className="w-full">
            <TabsList>
              <TabsTrigger value="booking-items">Booking Items</TabsTrigger>
              <TabsTrigger value="operations">Operations</TabsTrigger>
              <TabsTrigger value="folios">Folios</TabsTrigger>
            </TabsList>
            <TabsContent value="booking-items" className="mt-4">
              <StayBookingItemsTab propertyId={id} />
            </TabsContent>
            <TabsContent value="operations" className="mt-4">
              <StayOperationsTab propertyId={id} />
            </TabsContent>
            <TabsContent value="folios" className="mt-4">
              <StayFoliosTab propertyId={id} />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          <HousekeepingTasksTab propertyId={id} />
        </TabsContent>
      </Tabs>

      <PropertyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        property={property}
        onSuccess={() => {
          setDialogOpen(false)
          void refetch()
        }}
      />
    </div>
  )
}
