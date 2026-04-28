import { useQuery } from "@tanstack/react-query"
import { MaintenanceBlocksTab } from "@voyantjs/hospitality-ui/components/maintenance-blocks-tab"
import { MealPlansTab } from "@voyantjs/hospitality-ui/components/meal-plans-tab"
import { RatePlansTab } from "@voyantjs/hospitality-ui/components/rate-plans-tab"
import { RoomBlocksTab } from "@voyantjs/hospitality-ui/components/room-blocks-tab"
import { RoomInventoryTab } from "@voyantjs/hospitality-ui/components/room-inventory-tab"
import { RoomTypesTab } from "@voyantjs/hospitality-ui/components/room-types-tab"
import { RoomUnitsTab } from "@voyantjs/hospitality-ui/components/room-units-tab"
import { StayRulesTab } from "@voyantjs/hospitality-ui/components/stay-rules-tab"
import { Label } from "@voyantjs/ui/components"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@voyantjs/ui/components/tabs"
import { BedDouble } from "lucide-react"
import { useState } from "react"
import {
  getHospitalityFacilitiesQueryOptions,
  getHospitalityPropertiesQueryOptions,
} from "@/components/voyant/hospitality/hospitality-shared"
import { HousekeepingTasksTab } from "@/components/voyant/hospitality/housekeeping-tasks-tab"
import { RatePlanInventoryOverridesTab } from "@/components/voyant/hospitality/rate-plan-inventory-overrides-tab"
import { RatePlanRoomTypesTab } from "@/components/voyant/hospitality/rate-plan-room-types-tab"
import { RoomTypeRatesTab } from "@/components/voyant/hospitality/room-type-rates-tab"
import { StayBookingItemsTab } from "@/components/voyant/hospitality/stay-booking-items-tab"
import { StayFoliosTab } from "@/components/voyant/hospitality/stay-folios-tab"
import { StayOperationsTab } from "@/components/voyant/hospitality/stay-operations-tab"

export function HospitalityPage() {
  const [propertyId, setPropertyId] = useState<string>("")

  const propertiesQuery = useQuery(getHospitalityPropertiesQueryOptions())
  const facilitiesQuery = useQuery(getHospitalityFacilitiesQueryOptions())

  const properties = propertiesQuery.data?.data ?? []
  const facilities = facilitiesQuery.data?.data ?? []
  const facilityById = new Map(facilities.map((facility) => [facility.id, facility]))

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <BedDouble className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-2xl font-bold tracking-tight">Hospitality</h1>
      </div>

      <div className="flex max-w-md flex-col gap-2">
        <Label>Property</Label>
        <Select value={propertyId} onValueChange={(value) => setPropertyId(value ?? "")}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a property…" />
          </SelectTrigger>
          <SelectContent>
            {properties.length === 0 && (
              <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                {propertiesQuery.isPending ? "Loading…" : "No properties"}
              </div>
            )}
            {properties.map((property) => {
              const facilityName =
                facilityById.get(property.facilityId)?.name ?? property.facilityId
              return (
                <SelectItem key={property.id} value={property.id}>
                  {facilityName}
                  {property.brandName ? ` · ${property.brandName}` : ""}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Manage setup, inventory, stays and tasks for the selected property.
        </p>
      </div>

      {!propertyId && (
        <div className="rounded-md border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Select a property above to configure its hospitality setup.
          </p>
        </div>
      )}

      {propertyId && (
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
                <RoomTypesTab propertyId={propertyId} />
              </TabsContent>
              <TabsContent value="room-units" className="mt-4">
                <RoomUnitsTab propertyId={propertyId} />
              </TabsContent>
              <TabsContent value="meal-plans" className="mt-4">
                <MealPlansTab propertyId={propertyId} />
              </TabsContent>
              <TabsContent value="rate-plans" className="mt-4">
                <RatePlansTab propertyId={propertyId} />
              </TabsContent>
              <TabsContent value="rates" className="mt-4">
                <RoomTypeRatesTab propertyId={propertyId} />
              </TabsContent>
              <TabsContent value="stay-rules" className="mt-4">
                <StayRulesTab propertyId={propertyId} />
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
                <RoomInventoryTab propertyId={propertyId} />
              </TabsContent>
              <TabsContent value="rate-plan-room-types" className="mt-4">
                <RatePlanRoomTypesTab propertyId={propertyId} />
              </TabsContent>
              <TabsContent value="rate-plan-overrides" className="mt-4">
                <RatePlanInventoryOverridesTab propertyId={propertyId} />
              </TabsContent>
              <TabsContent value="room-blocks" className="mt-4">
                <RoomBlocksTab propertyId={propertyId} />
              </TabsContent>
              <TabsContent value="maintenance-blocks" className="mt-4">
                <MaintenanceBlocksTab propertyId={propertyId} />
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
                <StayBookingItemsTab propertyId={propertyId} />
              </TabsContent>
              <TabsContent value="operations" className="mt-4">
                <StayOperationsTab propertyId={propertyId} />
              </TabsContent>
              <TabsContent value="folios" className="mt-4">
                <StayFoliosTab propertyId={propertyId} />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="tasks" className="mt-4">
            <HousekeepingTasksTab propertyId={propertyId} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
