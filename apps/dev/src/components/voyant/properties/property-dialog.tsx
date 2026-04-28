import {
  type CreatePropertyInput,
  type UpdatePropertyInput,
  usePropertyMutation,
} from "@voyantjs/facilities-react"
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@voyantjs/ui/components"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { zodResolver } from "@/lib/zod-resolver"
import { FacilityCombobox } from "./facility-combobox"
import { PROPERTY_TYPES, type PropertyData } from "./property-shared"

type PropertyType = (typeof PROPERTY_TYPES)[number]

const intOrEmpty = z.coerce.number().int().optional().or(z.literal("")).nullable()

const formSchema = z.object({
  facilityId: z.string().min(1, "Facility is required"),
  propertyType: z.enum(PROPERTY_TYPES),
  brandName: z.string().optional().nullable(),
  groupName: z.string().optional().nullable(),
  rating: intOrEmpty,
  ratingScale: intOrEmpty,
  checkInTime: z.string().optional().nullable(),
  checkOutTime: z.string().optional().nullable(),
  policyNotes: z.string().optional().nullable(),
  amenityNotes: z.string().optional().nullable(),
})

type FormValues = z.input<typeof formSchema>
type FormOutput = z.output<typeof formSchema>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  property?: PropertyData
  onSuccess: () => void
}

export function PropertyDialog({ open, onOpenChange, property, onSuccess }: Props) {
  const isEditing = Boolean(property)
  const { create, update } = usePropertyMutation()

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      facilityId: "",
      propertyType: "hotel",
      brandName: "",
      groupName: "",
      rating: "",
      ratingScale: "",
      checkInTime: "",
      checkOutTime: "",
      policyNotes: "",
      amenityNotes: "",
    },
  })

  useEffect(() => {
    if (open && property) {
      form.reset({
        facilityId: property.facilityId,
        propertyType: property.propertyType as PropertyType,
        brandName: property.brandName ?? "",
        groupName: property.groupName ?? "",
        rating: property.rating ?? "",
        ratingScale: property.ratingScale ?? "",
        checkInTime: property.checkInTime ?? "",
        checkOutTime: property.checkOutTime ?? "",
        policyNotes: property.policyNotes ?? "",
        amenityNotes: property.amenityNotes ?? "",
      })
      return
    }
    if (open) {
      form.reset({
        facilityId: "",
        propertyType: "hotel",
        brandName: "",
        groupName: "",
        rating: "",
        ratingScale: "",
        checkInTime: "",
        checkOutTime: "",
        policyNotes: "",
        amenityNotes: "",
      })
    }
  }, [form, open, property])

  const onSubmit = async (values: FormOutput) => {
    const toInt = (value: number | string | null | undefined) =>
      typeof value === "number" ? value : null

    const payload: CreatePropertyInput | UpdatePropertyInput = {
      facilityId: values.facilityId,
      propertyType: values.propertyType,
      brandName: values.brandName || null,
      groupName: values.groupName || null,
      rating: toInt(values.rating),
      ratingScale: toInt(values.ratingScale),
      checkInTime: values.checkInTime || null,
      checkOutTime: values.checkOutTime || null,
      policyNotes: values.policyNotes || null,
      amenityNotes: values.amenityNotes || null,
    }

    if (isEditing) {
      await update.mutateAsync({ id: property!.id, input: payload })
    } else {
      await create.mutateAsync(payload as CreatePropertyInput)
    }
    onSuccess()
  }

  const isSubmitting = form.formState.isSubmitting || create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Property" : "Add Property"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            {!isEditing && (
              <div className="flex flex-col gap-2">
                <Label>Facility</Label>
                <FacilityCombobox
                  value={form.watch("facilityId") || null}
                  onChange={(value) =>
                    form.setValue("facilityId", value ?? "", { shouldValidate: true })
                  }
                  kind="property"
                />
                {form.formState.errors.facilityId && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.facilityId.message}
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Property type</Label>
                <Select
                  items={PROPERTY_TYPES.map((x) => ({ label: x.replace(/_/g, " "), value: x }))}
                  value={form.watch("propertyType")}
                  onValueChange={(value) => form.setValue("propertyType", value as PropertyType)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map((type) => (
                      <SelectItem key={type} value={type} className="capitalize">
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Brand name</Label>
                <Input {...form.register("brandName")} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Group name</Label>
                <Input {...form.register("groupName")} />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Rating</Label>
                <Input {...form.register("rating")} type="number" min="0" max="10" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Rating scale</Label>
                <Input {...form.register("ratingScale")} type="number" min="1" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Check-in</Label>
                <Input {...form.register("checkInTime")} placeholder="14:00" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Check-out</Label>
                <Input {...form.register("checkOutTime")} placeholder="11:00" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Policy notes</Label>
              <Textarea {...form.register("policyNotes")} />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Amenity notes</Label>
              <Textarea {...form.register("amenityNotes")} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Add Property"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
