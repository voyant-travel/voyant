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
} from "@voyantjs/ui/components"
import { DateTimePicker } from "@voyantjs/ui/components/date-time-picker"
import { Loader2 } from "lucide-react"
import { useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { useAdminMessages } from "@/lib/admin-i18n"
import { api } from "@/lib/api-client"
import { zodResolver } from "@/lib/zod-resolver"
import type {
  BookingOption,
  ChannelBookingLinkRow,
  ChannelProductMappingRow,
  ChannelRow,
  ProductOption,
} from "./distribution-shared"
import { nullableString, toIsoDateTime, toLocalDateTimeInput } from "./distribution-shared"

function createMappingFormSchema(
  channelRequired: string,
  productRequired: string,
  externalProductIdRequired: string,
) {
  return z.object({
    channelId: z.string().min(1, channelRequired),
    productId: z.string().min(1, productRequired),
    externalProductId: z.string().min(1, externalProductIdRequired),
    externalRateId: z.string().optional(),
    externalCategoryId: z.string().optional(),
    active: z.boolean(),
  })
}

export function ChannelProductMappingDialog({
  open,
  onOpenChange,
  mapping,
  channels,
  products,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mapping?: ChannelProductMappingRow
  channels: ChannelRow[]
  products: ProductOption[]
  onSuccess: () => void
}) {
  const messages = useAdminMessages()
  const dialogMessages = messages.distribution.dialogs.mapping
  const mappingFormSchema = useMemo(
    () =>
      createMappingFormSchema(
        dialogMessages.validation.channelRequired,
        dialogMessages.validation.productRequired,
        dialogMessages.validation.externalProductIdRequired,
      ),
    [
      dialogMessages.validation.channelRequired,
      dialogMessages.validation.productRequired,
      dialogMessages.validation.externalProductIdRequired,
    ],
  )
  const form = useForm({
    resolver: zodResolver(mappingFormSchema),
    defaultValues: {
      channelId: "",
      productId: "",
      externalProductId: "",
      externalRateId: "",
      externalCategoryId: "",
      active: true,
    },
  })

  useEffect(() => {
    if (open && mapping) {
      form.reset({
        channelId: mapping.channelId,
        productId: mapping.productId,
        externalProductId: mapping.externalProductId,
        externalRateId: mapping.externalRateId ?? "",
        externalCategoryId: mapping.externalCategoryId ?? "",
        active: mapping.active,
      })
    } else if (open) {
      form.reset()
    }
  }, [form, mapping, open])

  const isEditing = Boolean(mapping)

  const onSubmit = async (values: z.output<typeof mappingFormSchema>) => {
    const payload = {
      channelId: values.channelId,
      productId: values.productId,
      externalProductId: values.externalProductId,
      externalRateId: nullableString(values.externalRateId),
      externalCategoryId: nullableString(values.externalCategoryId),
      active: values.active,
    }

    if (isEditing) {
      await api.patch(`/v1/distribution/product-mappings/${mapping?.id}`, payload)
    } else {
      await api.post("/v1/distribution/product-mappings", payload)
    }
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? dialogMessages.editTitle : dialogMessages.createTitle}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid gap-2">
              <Label>{dialogMessages.labels.channel}</Label>
              <Select
                items={channels.map((channel) => ({ label: channel.name, value: channel.id }))}
                value={form.watch("channelId")}
                onValueChange={(value) => form.setValue("channelId", value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={dialogMessages.placeholders.selectChannel} />
                </SelectTrigger>
                <SelectContent>
                  {channels.map((channel) => (
                    <SelectItem key={channel.id} value={channel.id}>
                      {channel.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{dialogMessages.labels.product}</Label>
              <Select
                items={products.map((product) => ({ label: product.name, value: product.id }))}
                value={form.watch("productId")}
                onValueChange={(value) => form.setValue("productId", value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={dialogMessages.placeholders.selectProduct} />
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
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{dialogMessages.labels.externalProductId}</Label>
                <Input
                  {...form.register("externalProductId")}
                  placeholder={dialogMessages.placeholders.externalProductId}
                />
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.labels.externalRateId}</Label>
                <Input
                  {...form.register("externalRateId")}
                  placeholder={dialogMessages.placeholders.externalRateId}
                />
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.labels.externalCategoryId}</Label>
                <Input
                  {...form.register("externalCategoryId")}
                  placeholder={dialogMessages.placeholders.externalCategoryId}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <p className="text-sm font-medium">{dialogMessages.labels.active}</p>
                <p className="text-xs text-muted-foreground">
                  {dialogMessages.labels.activeDescription}
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
              {dialogMessages.actions.cancel}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? dialogMessages.actions.save : dialogMessages.actions.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function createBookingLinkFormSchema(channelRequired: string, bookingRequired: string) {
  return z.object({
    channelId: z.string().min(1, channelRequired),
    bookingId: z.string().min(1, bookingRequired),
    externalBookingId: z.string().optional(),
    externalReference: z.string().optional(),
    externalStatus: z.string().optional(),
    bookedAtExternal: z.string().optional(),
    lastSyncedAt: z.string().optional(),
  })
}

export function ChannelBookingLinkDialog({
  open,
  onOpenChange,
  bookingLink,
  channels,
  bookings,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingLink?: ChannelBookingLinkRow
  channels: ChannelRow[]
  bookings: BookingOption[]
  onSuccess: () => void
}) {
  const messages = useAdminMessages()
  const dialogMessages = messages.distribution.dialogs.bookingLink
  const bookingLinkFormSchema = useMemo(
    () =>
      createBookingLinkFormSchema(
        dialogMessages.validation.channelRequired,
        dialogMessages.validation.bookingRequired,
      ),
    [dialogMessages.validation.bookingRequired, dialogMessages.validation.channelRequired],
  )
  const form = useForm({
    resolver: zodResolver(bookingLinkFormSchema),
    defaultValues: {
      channelId: "",
      bookingId: "",
      externalBookingId: "",
      externalReference: "",
      externalStatus: "",
      bookedAtExternal: "",
      lastSyncedAt: "",
    },
  })

  useEffect(() => {
    if (open && bookingLink) {
      form.reset({
        channelId: bookingLink.channelId,
        bookingId: bookingLink.bookingId,
        externalBookingId: bookingLink.externalBookingId ?? "",
        externalReference: bookingLink.externalReference ?? "",
        externalStatus: bookingLink.externalStatus ?? "",
        bookedAtExternal: toLocalDateTimeInput(bookingLink.bookedAtExternal),
        lastSyncedAt: toLocalDateTimeInput(bookingLink.lastSyncedAt),
      })
    } else if (open) {
      form.reset()
    }
  }, [bookingLink, form, open])

  const isEditing = Boolean(bookingLink)

  const onSubmit = async (values: z.output<typeof bookingLinkFormSchema>) => {
    const payload = {
      channelId: values.channelId,
      bookingId: values.bookingId,
      externalBookingId: nullableString(values.externalBookingId),
      externalReference: nullableString(values.externalReference),
      externalStatus: nullableString(values.externalStatus),
      bookedAtExternal: toIsoDateTime(values.bookedAtExternal),
      lastSyncedAt: toIsoDateTime(values.lastSyncedAt),
    }

    if (isEditing) {
      await api.patch(`/v1/distribution/booking-links/${bookingLink?.id}`, payload)
    } else {
      await api.post("/v1/distribution/booking-links", payload)
    }
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? dialogMessages.editTitle : dialogMessages.createTitle}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid gap-2">
              <Label>{dialogMessages.labels.channel}</Label>
              <Select
                items={channels.map((channel) => ({ label: channel.name, value: channel.id }))}
                value={form.watch("channelId")}
                onValueChange={(value) => form.setValue("channelId", value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={dialogMessages.placeholders.selectChannel} />
                </SelectTrigger>
                <SelectContent>
                  {channels.map((channel) => (
                    <SelectItem key={channel.id} value={channel.id}>
                      {channel.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{dialogMessages.labels.booking}</Label>
              <Select
                items={bookings.map((booking) => ({
                  label: booking.bookingNumber,
                  value: booking.id,
                }))}
                value={form.watch("bookingId")}
                onValueChange={(value) => form.setValue("bookingId", value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={dialogMessages.placeholders.selectBooking} />
                </SelectTrigger>
                <SelectContent>
                  {bookings.map((booking) => (
                    <SelectItem key={booking.id} value={booking.id}>
                      {booking.bookingNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{dialogMessages.labels.externalBookingId}</Label>
                <Input
                  {...form.register("externalBookingId")}
                  placeholder={dialogMessages.placeholders.externalBookingId}
                />
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.labels.externalReference}</Label>
                <Input
                  {...form.register("externalReference")}
                  placeholder={dialogMessages.placeholders.externalReference}
                />
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.labels.externalStatus}</Label>
                <Input
                  {...form.register("externalStatus")}
                  placeholder={dialogMessages.placeholders.externalStatus}
                />
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.labels.bookedAtExternal}</Label>
                <DateTimePicker
                  value={form.watch("bookedAtExternal") || null}
                  onChange={(next) =>
                    form.setValue("bookedAtExternal", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder={dialogMessages.placeholders.bookedAtExternal}
                  className="w-full"
                />
              </div>
              <div className="grid gap-2">
                <Label>{dialogMessages.labels.lastSyncedAt}</Label>
                <DateTimePicker
                  value={form.watch("lastSyncedAt") || null}
                  onChange={(next) =>
                    form.setValue("lastSyncedAt", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder={dialogMessages.placeholders.lastSyncedAt}
                  className="w-full"
                />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {dialogMessages.actions.cancel}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? dialogMessages.actions.save : dialogMessages.actions.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
