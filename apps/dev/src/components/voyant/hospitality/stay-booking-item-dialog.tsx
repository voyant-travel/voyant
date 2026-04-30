import { type StayBookingItemRecord, useStayBookingItemMutation } from "@voyantjs/hospitality-react"
import { MealPlanCombobox } from "@voyantjs/hospitality-ui/components/meal-plan-combobox"
import { RatePlanCombobox } from "@voyantjs/hospitality-ui/components/rate-plan-combobox"
import { RoomTypeCombobox } from "@voyantjs/hospitality-ui/components/room-type-combobox"
import { RoomUnitCombobox } from "@voyantjs/hospitality-ui/components/room-unit-combobox"
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

const STATUSES = ["reserved", "checked_in", "checked_out", "cancelled", "no_show"] as const
type Status = (typeof STATUSES)[number]

const formSchema = z.object({
  bookingItemId: z.string().min(1, "Booking item ID is required"),
  roomTypeId: z.string().min(1, "Room type is required"),
  roomUnitId: z.string().optional().nullable(),
  ratePlanId: z.string().min(1, "Rate plan is required"),
  mealPlanId: z.string().optional().nullable(),
  checkInDate: z.string().min(1, "Check-in date is required"),
  checkOutDate: z.string().min(1, "Check-out date is required"),
  nightCount: z.coerce.number().int().min(1),
  roomCount: z.coerce.number().int().min(1),
  adults: z.coerce.number().int().min(0),
  children: z.coerce.number().int().min(0),
  infants: z.coerce.number().int().min(0),
  confirmationCode: z.string().optional().nullable(),
  voucherCode: z.string().optional().nullable(),
  status: z.enum(STATUSES),
  notes: z.string().optional().nullable(),
})

type FormValues = z.input<typeof formSchema>
type FormOutput = z.output<typeof formSchema>

export type StayBookingItemData = StayBookingItemRecord

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
  item?: StayBookingItemData
  onSuccess: () => void
}

export function StayBookingItemDialog({ open, onOpenChange, propertyId, item, onSuccess }: Props) {
  const isEditing = !!item
  const { create, update } = useStayBookingItemMutation()

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      bookingItemId: "",
      roomTypeId: "",
      roomUnitId: "",
      ratePlanId: "",
      mealPlanId: "",
      checkInDate: "",
      checkOutDate: "",
      nightCount: 1,
      roomCount: 1,
      adults: 1,
      children: 0,
      infants: 0,
      confirmationCode: "",
      voucherCode: "",
      status: "reserved",
      notes: "",
    },
  })

  useEffect(() => {
    if (open && item) {
      form.reset({
        bookingItemId: item.bookingItemId,
        roomTypeId: item.roomTypeId,
        roomUnitId: item.roomUnitId ?? "",
        ratePlanId: item.ratePlanId,
        mealPlanId: item.mealPlanId ?? "",
        checkInDate: item.checkInDate,
        checkOutDate: item.checkOutDate,
        nightCount: item.nightCount,
        roomCount: item.roomCount,
        adults: item.adults,
        children: item.children,
        infants: item.infants,
        confirmationCode: item.confirmationCode ?? "",
        voucherCode: item.voucherCode ?? "",
        status: item.status,
        notes: item.notes ?? "",
      })
    } else if (open) {
      form.reset({
        bookingItemId: "",
        roomTypeId: "",
        roomUnitId: "",
        ratePlanId: "",
        mealPlanId: "",
        checkInDate: "",
        checkOutDate: "",
        nightCount: 1,
        roomCount: 1,
        adults: 1,
        children: 0,
        infants: 0,
        confirmationCode: "",
        voucherCode: "",
        status: "reserved",
        notes: "",
      })
    }
  }, [open, item, form])

  const onSubmit = async (values: FormOutput) => {
    const payload = {
      bookingItemId: values.bookingItemId,
      propertyId,
      roomTypeId: values.roomTypeId,
      roomUnitId: values.roomUnitId || null,
      ratePlanId: values.ratePlanId,
      mealPlanId: values.mealPlanId || null,
      checkInDate: values.checkInDate,
      checkOutDate: values.checkOutDate,
      nightCount: values.nightCount,
      roomCount: values.roomCount,
      adults: values.adults,
      children: values.children,
      infants: values.infants,
      confirmationCode: values.confirmationCode || null,
      voucherCode: values.voucherCode || null,
      status: values.status,
      notes: values.notes || null,
    }
    if (isEditing) {
      await update.mutateAsync({ id: item.id, input: payload })
    } else {
      await create.mutateAsync(payload)
    }
    onSuccess()
  }

  const isSubmitting = form.formState.isSubmitting || create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Stay Booking Item" : "Add Stay Booking Item"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label>Booking item ID</Label>
              <Input
                {...form.register("bookingItemId")}
                placeholder="bkit_…"
                disabled={isEditing}
              />
              {form.formState.errors.bookingItemId && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.bookingItemId.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Room type</Label>
                <RoomTypeCombobox
                  propertyId={propertyId}
                  value={form.watch("roomTypeId")}
                  onChange={(value) => form.setValue("roomTypeId", value ?? "")}
                  placeholder="Select…"
                  disabled={!open}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Room unit (optional)</Label>
                <RoomUnitCombobox
                  propertyId={propertyId}
                  value={form.watch("roomUnitId")}
                  onChange={(value) => form.setValue("roomUnitId", value ?? "")}
                  placeholder="None"
                  disabled={!open}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Rate plan</Label>
                <RatePlanCombobox
                  propertyId={propertyId}
                  value={form.watch("ratePlanId")}
                  onChange={(value) => form.setValue("ratePlanId", value ?? "")}
                  placeholder="Select…"
                  disabled={!open}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Meal plan (optional)</Label>
                <MealPlanCombobox
                  propertyId={propertyId}
                  value={form.watch("mealPlanId")}
                  onChange={(value) => form.setValue("mealPlanId", value ?? "")}
                  placeholder="None"
                  disabled={!open}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-2">
                <Label>Check-in</Label>
                <Input {...form.register("checkInDate")} type="date" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Check-out</Label>
                <Input {...form.register("checkOutDate")} type="date" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Nights</Label>
                <Input {...form.register("nightCount")} type="number" min="1" />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div className="flex flex-col gap-2">
                <Label>Rooms</Label>
                <Input {...form.register("roomCount")} type="number" min="1" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Adults</Label>
                <Input {...form.register("adults")} type="number" min="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Children</Label>
                <Input {...form.register("children")} type="number" min="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Infants</Label>
                <Input {...form.register("infants")} type="number" min="0" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-2">
                <Label>Status</Label>
                <Select
                  items={STATUSES.map((x) => ({ label: x.replace(/_/g, " "), value: x }))}
                  value={form.watch("status")}
                  onValueChange={(v) => form.setValue("status", v as Status)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Confirmation</Label>
                <Input {...form.register("confirmationCode")} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Voucher</Label>
                <Input {...form.register("voucherCode")} />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Notes</Label>
              <Textarea {...form.register("notes")} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Add Stay"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
