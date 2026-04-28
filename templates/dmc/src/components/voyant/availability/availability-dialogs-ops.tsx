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
import type {
  AvailabilityCloseoutRow,
  AvailabilityPickupPointRow,
  AvailabilitySlotRow,
  ProductOption,
} from "@/components/voyant/availability/availability-shared"
import {
  formatDateTime,
  NONE_VALUE,
  nullableString,
} from "@/components/voyant/availability/availability-shared"
import { useAdminMessages } from "@/lib/admin-i18n"
import { api } from "@/lib/api-client"
import { zodResolver } from "@/lib/zod-resolver"

function getCloseoutFormSchema(messages: ReturnType<typeof useAdminMessages>) {
  return z.object({
    productId: z.string().min(1, messages.availability.dialogs.closeout.validationProductRequired),
    slotId: z.string().optional(),
    dateLocal: z.string().min(1, messages.availability.dialogs.closeout.validationDateRequired),
    reason: z.string().optional(),
  })
}

type CloseoutFormSchema = ReturnType<typeof getCloseoutFormSchema>
type CloseoutFormValues = z.input<CloseoutFormSchema>
type CloseoutFormOutput = z.output<CloseoutFormSchema>

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
  const messages = useAdminMessages()
  const closeoutMessages = messages.availability.dialogs.closeout
  const closeoutFormSchema = getCloseoutFormSchema(messages)
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
          <DialogTitle>
            {isEditing ? closeoutMessages.editTitle : closeoutMessages.newTitle}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid gap-2">
              <Label>{closeoutMessages.productLabel}</Label>
              <Select
                items={products.map((product) => ({ label: product.name, value: product.id }))}
                value={form.watch("productId")}
                onValueChange={(value) => form.setValue("productId", value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={closeoutMessages.selectProductPlaceholder} />
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
              <Label>{closeoutMessages.slotLabel}</Label>
              <Select
                value={form.watch("slotId") ?? NONE_VALUE}
                onValueChange={(value) => form.setValue("slotId", value ?? NONE_VALUE)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={closeoutMessages.optionalSlotPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>{closeoutMessages.productLevelOption}</SelectItem>
                  {filteredSlots.map((slot) => (
                    <SelectItem key={slot.id} value={slot.id}>
                      {slot.dateLocal} · {formatDateTime(slot.startsAt)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{closeoutMessages.dateLabel}</Label>
              <DatePicker
                value={form.watch("dateLocal") || null}
                onChange={(nextValue) =>
                  form.setValue("dateLocal", nextValue ?? "", {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                placeholder={closeoutMessages.datePlaceholder}
                className="w-full"
              />
            </div>
            <div className="grid gap-2">
              <Label>{closeoutMessages.reasonLabel}</Label>
              <Textarea
                {...form.register("reason")}
                placeholder={closeoutMessages.reasonPlaceholder}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {closeoutMessages.cancel}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? closeoutMessages.save : closeoutMessages.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function getPickupPointFormSchema(messages: ReturnType<typeof useAdminMessages>) {
  return z.object({
    productId: z
      .string()
      .min(1, messages.availability.dialogs.pickupPoint.validationProductRequired),
    name: z.string().min(1, messages.availability.dialogs.pickupPoint.validationNameRequired),
    description: z.string().optional(),
    locationText: z.string().optional(),
    active: z.boolean(),
  })
}

type PickupPointFormSchema = ReturnType<typeof getPickupPointFormSchema>
type PickupPointFormValues = z.input<PickupPointFormSchema>
type PickupPointFormOutput = z.output<PickupPointFormSchema>

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
  const messages = useAdminMessages()
  const pickupPointMessages = messages.availability.dialogs.pickupPoint
  const pickupPointFormSchema = getPickupPointFormSchema(messages)
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
          <DialogTitle>
            {isEditing ? pickupPointMessages.editTitle : pickupPointMessages.newTitle}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid gap-2">
              <Label>{pickupPointMessages.productLabel}</Label>
              <Select
                items={products.map((product) => ({ label: product.name, value: product.id }))}
                value={form.watch("productId")}
                onValueChange={(value) => form.setValue("productId", value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={pickupPointMessages.selectProductPlaceholder} />
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
              <Label>{pickupPointMessages.nameLabel}</Label>
              <Input {...form.register("name")} placeholder={pickupPointMessages.namePlaceholder} />
            </div>
            <div className="grid gap-2">
              <Label>{pickupPointMessages.locationTextLabel}</Label>
              <Input
                {...form.register("locationText")}
                placeholder={pickupPointMessages.locationTextPlaceholder}
              />
            </div>
            <div className="grid gap-2">
              <Label>{pickupPointMessages.descriptionLabel}</Label>
              <Textarea
                {...form.register("description")}
                placeholder={pickupPointMessages.descriptionPlaceholder}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <p className="text-sm font-medium">{pickupPointMessages.activeTitle}</p>
                <p className="text-xs text-muted-foreground">
                  {pickupPointMessages.activeDescription}
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
              {pickupPointMessages.cancel}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? pickupPointMessages.save : pickupPointMessages.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
