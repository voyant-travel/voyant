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
  Switch,
  Textarea,
} from "@voyantjs/ui/components"
import { DatePicker } from "@voyantjs/ui/components/date-picker"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { useUser } from "@/components/providers/user-provider"
import { api } from "@/lib/api-client"
import { zodResolver } from "@/lib/zod-resolver"
import type {
  AvailabilityCloseoutRow,
  AvailabilityPickupPointRow,
  AvailabilitySlotRow,
  ProductOption,
} from "./availability-shared"
import { formatDateTime, NONE_VALUE, nullableString } from "./availability-shared"

const closeoutFormSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  slotId: z.string().optional(),
  dateLocal: z.string().min(1, "Date is required"),
  reason: z.string().optional(),
})

type CloseoutFormValues = z.input<typeof closeoutFormSchema>
type CloseoutFormOutput = z.output<typeof closeoutFormSchema>

export function AvailabilityCloseoutDialog({
  open,
  onOpenChange,
  closeout,
  products,
  slots,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  closeout?: AvailabilityCloseoutRow
  products: ProductOption[]
  slots: AvailabilitySlotRow[]
  onSuccess: () => void
}) {
  const { user } = useUser()
  const form = useForm<CloseoutFormValues, unknown, CloseoutFormOutput>({
    resolver: zodResolver(closeoutFormSchema),
    defaultValues: {
      productId: "",
      slotId: NONE_VALUE,
      dateLocal: "",
      reason: "",
    },
  })

  useEffect(() => {
    if (open && closeout) {
      form.reset({
        productId: closeout.productId,
        slotId: closeout.slotId ?? NONE_VALUE,
        dateLocal: closeout.dateLocal,
        reason: closeout.reason ?? "",
      })
    } else if (open) {
      form.reset()
    }
  }, [closeout, form, open])

  const selectedProductId = form.watch("productId")
  const filteredSlots = slots.filter((slot) => slot.productId === selectedProductId)
  const isEditing = Boolean(closeout)

  const onSubmit = async (values: CloseoutFormOutput) => {
    const payload = {
      productId: values.productId,
      slotId: values.slotId === NONE_VALUE ? null : values.slotId,
      dateLocal: values.dateLocal,
      reason: nullableString(values.reason),
      createdBy: user?.email ?? null,
    }

    if (isEditing) {
      await api.patch(`/v1/availability/closeouts/${closeout?.id}`, payload)
    } else {
      await api.post("/v1/availability/closeouts", payload)
    }
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Closeout" : "New Closeout"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid gap-2">
              <Label>Product</Label>
              <Select
                items={products.map((product) => ({ label: product.name, value: product.id }))}
                value={form.watch("productId")}
                onValueChange={(value) => form.setValue("productId", value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Slot</Label>
              <Select
                items={[
                  { label: "Product-level closeout", value: NONE_VALUE },
                  ...filteredSlots.map((slot) => ({
                    label: `${slot.dateLocal} · ${formatDateTime(slot.startsAt)}`,
                    value: slot.id,
                  })),
                ]}
                value={form.watch("slotId") ?? NONE_VALUE}
                onValueChange={(value) => form.setValue("slotId", value ?? NONE_VALUE)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Optional slot" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Product-level closeout</SelectItem>
                  {filteredSlots.map((slot) => (
                    <SelectItem key={slot.id} value={slot.id}>
                      {slot.dateLocal} · {formatDateTime(slot.startsAt)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Date</Label>
              <DatePicker
                value={form.watch("dateLocal") || null}
                onChange={(nextValue) =>
                  form.setValue("dateLocal", nextValue ?? "", {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                placeholder="Pick date"
                className="w-full"
              />
            </div>
            <div className="grid gap-2">
              <Label>Reason</Label>
              <Textarea
                {...form.register("reason")}
                placeholder="Weather, charter hold, operational blackout..."
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Closeout" : "Create Closeout"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const pickupPointFormSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  locationText: z.string().optional(),
  active: z.boolean(),
})

type PickupPointFormValues = z.input<typeof pickupPointFormSchema>
type PickupPointFormOutput = z.output<typeof pickupPointFormSchema>

export function AvailabilityPickupPointDialog({
  open,
  onOpenChange,
  pickupPoint,
  products,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pickupPoint?: AvailabilityPickupPointRow
  products: ProductOption[]
  onSuccess: () => void
}) {
  const form = useForm<PickupPointFormValues, unknown, PickupPointFormOutput>({
    resolver: zodResolver(pickupPointFormSchema),
    defaultValues: {
      productId: "",
      name: "",
      description: "",
      locationText: "",
      active: true,
    },
  })

  useEffect(() => {
    if (open && pickupPoint) {
      form.reset({
        productId: pickupPoint.productId,
        name: pickupPoint.name,
        description: pickupPoint.description ?? "",
        locationText: pickupPoint.locationText ?? "",
        active: pickupPoint.active,
      })
    } else if (open) {
      form.reset()
    }
  }, [form, open, pickupPoint])

  const isEditing = Boolean(pickupPoint)

  const onSubmit = async (values: PickupPointFormOutput) => {
    const payload = {
      productId: values.productId,
      name: values.name,
      description: nullableString(values.description),
      locationText: nullableString(values.locationText),
      active: values.active,
    }

    if (isEditing) {
      await api.patch(`/v1/availability/pickup-points/${pickupPoint?.id}`, payload)
    } else {
      await api.post("/v1/availability/pickup-points", payload)
    }
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Pickup Point" : "New Pickup Point"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid gap-2">
              <Label>Product</Label>
              <Select
                items={products.map((product) => ({ label: product.name, value: product.id }))}
                value={form.watch("productId")}
                onValueChange={(value) => form.setValue("productId", value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input {...form.register("name")} placeholder="Port Gate A" />
            </div>
            <div className="grid gap-2">
              <Label>Location Text</Label>
              <Input {...form.register("locationText")} placeholder="Main harbor pickup lane" />
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea
                {...form.register("description")}
                placeholder="Instructions, landmark notes, timing..."
              />
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">
                  Allow this pickup point to be used in slot planning.
                </p>
              </div>
              <Switch
                checked={form.watch("active")}
                onCheckedChange={(checked) => form.setValue("active", checked)}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Pickup Point" : "Create Pickup Point"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
