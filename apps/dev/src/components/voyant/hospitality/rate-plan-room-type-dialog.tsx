import {
  type RatePlanRoomTypeRecord,
  useRatePlanRoomTypeMutation,
} from "@voyantjs/hospitality-react"
import { RatePlanCombobox } from "@voyantjs/hospitality-ui/components/rate-plan-combobox"
import { RoomTypeCombobox } from "@voyantjs/hospitality-ui/components/room-type-combobox"
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
  Switch,
} from "@voyantjs/ui/components"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { EntityCombobox } from "@/components/ui/entity-combobox"
import { zodResolver } from "@/lib/zod-resolver"

const formSchema = z.object({
  ratePlanId: z.string().min(1, "Rate plan is required"),
  roomTypeId: z.string().min(1, "Room type is required"),
  productId: z.string().optional().nullable(),
  optionId: z.string().optional().nullable(),
  unitId: z.string().optional().nullable(),
  active: z.boolean(),
  sortOrder: z.coerce.number().int(),
})

type FormValues = z.input<typeof formSchema>
type FormOutput = z.output<typeof formSchema>

export type RatePlanRoomTypeData = RatePlanRoomTypeRecord

type ProductRef = { id: string; name: string; status?: string | null; bookingMode?: string | null }
type ProductOptionRef = {
  id: string
  name: string
  code?: string | null
  status?: string | null
}
type OptionUnitRef = {
  id: string
  name: string
  code?: string | null
  unitType?: string | null
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
  link?: RatePlanRoomTypeData
  onSuccess: () => void
}

export function RatePlanRoomTypeDialog({ open, onOpenChange, propertyId, link, onSuccess }: Props) {
  const isEditing = !!link
  const { create, update } = useRatePlanRoomTypeMutation()

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ratePlanId: "",
      roomTypeId: "",
      productId: "",
      optionId: "",
      unitId: "",
      active: true,
      sortOrder: 0,
    },
  })

  useEffect(() => {
    if (open && link) {
      form.reset({
        ratePlanId: link.ratePlanId,
        roomTypeId: link.roomTypeId,
        productId: link.productId ?? "",
        optionId: link.optionId ?? "",
        unitId: link.unitId ?? "",
        active: link.active,
        sortOrder: link.sortOrder,
      })
    } else if (open) {
      form.reset({
        ratePlanId: "",
        roomTypeId: "",
        productId: "",
        optionId: "",
        unitId: "",
        active: true,
        sortOrder: 0,
      })
    }
  }, [open, link, form])

  const onSubmit = async (values: FormOutput) => {
    const payload = {
      ratePlanId: values.ratePlanId,
      roomTypeId: values.roomTypeId,
      productId: values.productId || null,
      optionId: values.optionId || null,
      unitId: values.unitId || null,
      active: values.active,
      sortOrder: values.sortOrder,
    }
    if (isEditing) {
      await update.mutateAsync({ id: link.id, input: payload })
    } else {
      await create.mutateAsync(payload)
    }
    onSuccess()
  }

  const isSubmitting = form.formState.isSubmitting || create.isPending || update.isPending
  const selectedProductId = form.watch("productId") || null
  const selectedOptionId = form.watch("optionId") || null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Link" : "Link Rate Plan to Room Type"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label>Rate plan</Label>
              <RatePlanCombobox
                propertyId={propertyId}
                value={form.watch("ratePlanId")}
                onChange={(value) => form.setValue("ratePlanId", value ?? "")}
                placeholder="Select a rate plan…"
                disabled={isEditing}
              />
              {form.formState.errors.ratePlanId && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.ratePlanId.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label>Room type</Label>
              <RoomTypeCombobox
                propertyId={propertyId}
                value={form.watch("roomTypeId")}
                onChange={(value) => form.setValue("roomTypeId", value ?? "")}
                placeholder="Select a room type…"
                disabled={isEditing}
              />
              {form.formState.errors.roomTypeId && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.roomTypeId.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-2">
                <Label>Product</Label>
                <EntityCombobox<ProductRef>
                  value={selectedProductId}
                  onChange={(id) => {
                    form.setValue("productId", id ?? "", {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                    form.setValue("optionId", "")
                    form.setValue("unitId", "")
                  }}
                  endpoint="/v1/products"
                  detailEndpoint="/v1/products/:id"
                  queryKey={["hospitality", "rate-plan-room-types", "products"]}
                  getLabel={(product) => product.name}
                  getSecondary={(product) =>
                    [product.status, product.bookingMode].filter(Boolean).join(" / ") || undefined
                  }
                  placeholder="Search products"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Option</Label>
                <EntityCombobox<ProductOptionRef>
                  value={selectedOptionId}
                  onChange={(id) => {
                    form.setValue("optionId", id ?? "", {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                    form.setValue("unitId", "")
                  }}
                  endpoint={`/v1/products/options?productId=${encodeURIComponent(
                    selectedProductId ?? "",
                  )}`}
                  detailEndpoint="/v1/products/options/:id"
                  queryKey={[
                    "hospitality",
                    "rate-plan-room-types",
                    "product-options",
                    selectedProductId,
                  ]}
                  getLabel={(option) => option.name}
                  getSecondary={(option) =>
                    [option.code, option.status].filter(Boolean).join(" / ") || undefined
                  }
                  placeholder="Search options"
                  disabled={!selectedProductId}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Unit</Label>
                <EntityCombobox<OptionUnitRef>
                  value={form.watch("unitId") || null}
                  onChange={(id) =>
                    form.setValue("unitId", id ?? "", {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  endpoint={`/v1/products/units?optionId=${encodeURIComponent(
                    selectedOptionId ?? "",
                  )}`}
                  detailEndpoint="/v1/products/units/:id"
                  queryKey={[
                    "hospitality",
                    "rate-plan-room-types",
                    "option-units",
                    selectedOptionId,
                  ]}
                  getLabel={(unit) => unit.name}
                  getSecondary={(unit) =>
                    [unit.code, unit.unitType].filter(Boolean).join(" / ") || undefined
                  }
                  placeholder="Search units"
                  disabled={!selectedOptionId}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("active")}
                  onCheckedChange={(v) => form.setValue("active", v)}
                />
                <Label>Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Label>Sort</Label>
                <Input {...form.register("sortOrder")} type="number" className="w-20" />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Create Link"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
