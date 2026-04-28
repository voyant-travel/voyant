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
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
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

const mappingFormSchema = z.object({
  channelId: z.string().min(1, "Channel is required"),
  productId: z.string().min(1, "Product is required"),
  externalProductId: z.string().min(1, "External product ID is required"),
  externalRateId: z.string().optional(),
  externalCategoryId: z.string().optional(),
  active: z.boolean(),
})

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
          <DialogTitle>{isEditing ? "Edit Product Mapping" : "New Product Mapping"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid gap-2">
              <Label>Channel</Label>
              <Select
                items={channels.map((channel) => ({ label: channel.name, value: channel.id }))}
                value={form.watch("channelId")}
                onValueChange={(value) => form.setValue("channelId", value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select channel" />
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
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>External Product ID</Label>
                <Input {...form.register("externalProductId")} placeholder="fh_12345" />
              </div>
              <div className="grid gap-2">
                <Label>External Rate ID</Label>
                <Input {...form.register("externalRateId")} placeholder="adult" />
              </div>
              <div className="grid gap-2">
                <Label>External Category ID</Label>
                <Input {...form.register("externalCategoryId")} placeholder="high-season" />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">
                  Include this mapping in outbound sync and reconciliation.
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
              {isEditing ? "Save Mapping" : "Create Mapping"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const bookingLinkFormSchema = z.object({
  channelId: z.string().min(1, "Channel is required"),
  bookingId: z.string().min(1, "Booking is required"),
  externalBookingId: z.string().optional(),
  externalReference: z.string().optional(),
  externalStatus: z.string().optional(),
  bookedAtExternal: z.string().optional(),
  lastSyncedAt: z.string().optional(),
})

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
          <DialogTitle>{isEditing ? "Edit Booking Link" : "New Booking Link"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid gap-2">
              <Label>Channel</Label>
              <Select
                items={channels.map((channel) => ({ label: channel.name, value: channel.id }))}
                value={form.watch("channelId")}
                onValueChange={(value) => form.setValue("channelId", value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select channel" />
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
              <Label>Booking</Label>
              <Select
                items={bookings.map((booking) => ({
                  label: booking.bookingNumber,
                  value: booking.id,
                }))}
                value={form.watch("bookingId")}
                onValueChange={(value) => form.setValue("bookingId", value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select booking" />
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
                <Label>External Booking ID</Label>
                <Input {...form.register("externalBookingId")} placeholder="123456" />
              </div>
              <div className="grid gap-2">
                <Label>External Reference</Label>
                <Input {...form.register("externalReference")} placeholder="OTA-REF-002" />
              </div>
              <div className="grid gap-2">
                <Label>External Status</Label>
                <Input {...form.register("externalStatus")} placeholder="confirmed" />
              </div>
              <div className="grid gap-2">
                <Label>Booked At External</Label>
                <DateTimePicker
                  value={form.watch("bookedAtExternal") || null}
                  onChange={(next) =>
                    form.setValue("bookedAtExternal", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder="Select booking date & time"
                  className="w-full"
                />
              </div>
              <div className="grid gap-2">
                <Label>Last Synced At</Label>
                <DateTimePicker
                  value={form.watch("lastSyncedAt") || null}
                  onChange={(next) =>
                    form.setValue("lastSyncedAt", next ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  placeholder="Select last sync date & time"
                  className="w-full"
                />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Booking Link" : "Create Booking Link"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
