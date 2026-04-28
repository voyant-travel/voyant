import {
  type RatePlanRoomTypeRecord,
  useRatePlanRoomTypeMutation,
} from "@voyantjs/hospitality-react"
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
import { zodResolver } from "@/lib/zod-resolver"
import { RatePlanCombobox } from "./rate-plan-combobox"
import { RoomTypeCombobox } from "./room-type-combobox"

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
                <Label>Product ID</Label>
                <Input {...form.register("productId")} placeholder="prod_…" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Option ID</Label>
                <Input {...form.register("optionId")} placeholder="opt_…" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Unit ID</Label>
                <Input {...form.register("unitId")} placeholder="unit_…" />
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
