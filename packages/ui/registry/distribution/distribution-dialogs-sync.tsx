import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
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
} from "@/components/ui"
import { DateTimePicker } from "@/components/ui/date-time-picker"
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
import { useRegistryDistributionMessagesOrDefault } from "./i18n/provider"

function getMappingFormSchema(
  messages: ReturnType<typeof useRegistryDistributionMessagesOrDefault>,
) {
  return z.object({
    channelId: z.string().min(1, messages.dialogs.mapping.validation.channelRequired),
    productId: z.string().min(1, messages.dialogs.mapping.validation.productRequired),
    externalProductId: z
      .string()
      .min(1, messages.dialogs.mapping.validation.externalProductRequired),
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
  const messages = useRegistryDistributionMessagesOrDefault()
  const dialog = messages.dialogs.mapping
  const form = useForm({
    resolver: zodResolver(getMappingFormSchema(messages)),
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

  const onSubmit = async (values: z.output<ReturnType<typeof getMappingFormSchema>>) => {
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
          <DialogTitle>{isEditing ? dialog.titleEdit : dialog.titleNew}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid gap-2">
              <Label>{dialog.fields.channel}</Label>
              <Select
                items={channels.map((channel) => ({ label: channel.name, value: channel.id }))}
                value={form.watch("channelId")}
                onValueChange={(value) => form.setValue("channelId", value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={dialog.placeholders.selectChannel} />
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
              <Label>{dialog.fields.product}</Label>
              <Select
                items={products.map((product) => ({ label: product.name, value: product.id }))}
                value={form.watch("productId")}
                onValueChange={(value) => form.setValue("productId", value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={dialog.placeholders.selectProduct} />
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
                <Label>{dialog.fields.externalProductId}</Label>
                <Input
                  {...form.register("externalProductId")}
                  placeholder={dialog.placeholders.externalProductId}
                />
              </div>
              <div className="grid gap-2">
                <Label>{dialog.fields.externalRateId}</Label>
                <Input
                  {...form.register("externalRateId")}
                  placeholder={dialog.placeholders.externalRateId}
                />
              </div>
              <div className="grid gap-2">
                <Label>{dialog.fields.externalCategoryId}</Label>
                <Input
                  {...form.register("externalCategoryId")}
                  placeholder={dialog.placeholders.externalCategoryId}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <p className="text-sm font-medium">{dialog.fields.activeTitle}</p>
                <p className="text-xs text-muted-foreground">{dialog.fields.activeDescription}</p>
              </div>
              <Switch
                checked={form.watch("active")}
                onCheckedChange={(checked) => form.setValue("active", checked)}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? dialog.save : dialog.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function getBookingLinkFormSchema(
  messages: ReturnType<typeof useRegistryDistributionMessagesOrDefault>,
) {
  return z.object({
    channelId: z.string().min(1, messages.dialogs.bookingLink.validation.channelRequired),
    bookingId: z.string().min(1, messages.dialogs.bookingLink.validation.bookingRequired),
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
  const messages = useRegistryDistributionMessagesOrDefault()
  const dialog = messages.dialogs.bookingLink
  const form = useForm({
    resolver: zodResolver(getBookingLinkFormSchema(messages)),
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

  const onSubmit = async (values: z.output<ReturnType<typeof getBookingLinkFormSchema>>) => {
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
          <DialogTitle>{isEditing ? dialog.titleEdit : dialog.titleNew}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid gap-2">
              <Label>{dialog.fields.channel}</Label>
              <Select
                items={channels.map((channel) => ({ label: channel.name, value: channel.id }))}
                value={form.watch("channelId")}
                onValueChange={(value) => form.setValue("channelId", value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={dialog.placeholders.selectChannel} />
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
              <Label>{dialog.fields.booking}</Label>
              <Select
                items={bookings.map((booking) => ({
                  label: booking.bookingNumber,
                  value: booking.id,
                }))}
                value={form.watch("bookingId")}
                onValueChange={(value) => form.setValue("bookingId", value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={dialog.placeholders.selectBooking} />
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
                <Label>{dialog.fields.externalBookingId}</Label>
                <Input
                  {...form.register("externalBookingId")}
                  placeholder={dialog.placeholders.externalBookingId}
                />
              </div>
              <div className="grid gap-2">
                <Label>{dialog.fields.externalReference}</Label>
                <Input
                  {...form.register("externalReference")}
                  placeholder={dialog.placeholders.externalReference}
                />
              </div>
              <div className="grid gap-2">
                <Label>{dialog.fields.externalStatus}</Label>
                <Input
                  {...form.register("externalStatus")}
                  placeholder={dialog.placeholders.externalStatus}
                />
              </div>
              <div className="grid gap-2">
                <Label>{dialog.fields.bookedAtExternal}</Label>
                <DateTimePicker
                  value={form.watch("bookedAtExternal") || null}
                  onChange={(next) =>
                    form.setValue("bookedAtExternal", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder={dialog.placeholders.bookedAtExternal}
                  className="w-full"
                />
              </div>
              <div className="grid gap-2">
                <Label>{dialog.fields.lastSyncedAt}</Label>
                <DateTimePicker
                  value={form.watch("lastSyncedAt") || null}
                  onChange={(next) =>
                    form.setValue("lastSyncedAt", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder={dialog.placeholders.lastSyncedAt}
                  className="w-full"
                />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? dialog.save : dialog.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
