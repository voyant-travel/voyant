import { Link } from "@tanstack/react-router"
import { useFacility, useProperty } from "@voyantjs/facilities-react"
import { Badge, Button } from "@voyantjs/ui/components"
import { buttonVariants } from "@voyantjs/ui/components/button"
import { ArrowLeft, Building2, Loader2, Pencil } from "lucide-react"
import { useState } from "react"
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
