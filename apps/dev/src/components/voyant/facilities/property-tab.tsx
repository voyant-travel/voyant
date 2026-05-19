import {
  type CreatePropertyInput,
  type UpdatePropertyInput,
  useProperties,
  usePropertyMutation,
} from "@voyantjs/facilities-react"
import {
  Button,
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

const PROPERTY_TYPES = [
  "hotel",
  "resort",
  "villa",
  "apartment",
  "hostel",
  "lodge",
  "camp",
  "other",
] as const
type PropertyType = (typeof PROPERTY_TYPES)[number]
const intOrEmpty = z.coerce.number().int().optional().or(z.literal("")).nullable()

const formSchema = z.object({
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
type Props = { facilityId: string }

export function PropertyTab({ facilityId }: Props) {
  const { data, isPending, refetch } = useProperties({ facilityId, limit: 1, offset: 0 })
  const { create, update } = usePropertyMutation()
  const property = data?.data[0]
  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
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
    if (!property) return
    form.reset({
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
  }, [form, property])

  const onSubmit = async (values: FormOutput) => {
    const toInt = (value: number | string | null | undefined) =>
      typeof value === "number" ? value : null
    const payload: CreatePropertyInput | UpdatePropertyInput = {
      facilityId,
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

    if (property) {
      await update.mutateAsync({ id: property.id, input: payload })
    } else {
      await create.mutateAsync(payload as CreatePropertyInput)
    }
    void refetch()
  }

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <p className="mb-4 text-sm text-muted-foreground">
        {property
          ? "Extends this facility with property-specific fields."
          : "No property row exists for this facility yet. Fill out this form to create one."}
      </p>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
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
            <Input {...form.register("brandName")} placeholder="Hilton" />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Group name</Label>
            <Input {...form.register("groupName")} placeholder="Collection Brands" />
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
            <Label>Check-in time</Label>
            <Input {...form.register("checkInTime")} placeholder="14:00" />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Check-out time</Label>
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

        <div>
          <Button
            type="submit"
            disabled={form.formState.isSubmitting || create.isPending || update.isPending}
          >
            {(form.formState.isSubmitting || create.isPending || update.isPending) && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {property ? "Save Changes" : "Create Property"}
          </Button>
        </div>
      </form>
    </div>
  )
}
