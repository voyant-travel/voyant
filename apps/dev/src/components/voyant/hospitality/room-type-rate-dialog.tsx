import {
  type RoomTypeRateRecord,
  useRatePlan,
  useRoomTypeRateMutation,
} from "@voyantjs/hospitality-react"
import { RatePlanCombobox } from "@voyantjs/hospitality-ui/components/rate-plan-combobox"
import { RoomTypeCombobox } from "@voyantjs/hospitality-ui/components/room-type-combobox"
import { usePriceSchedules } from "@voyantjs/pricing-react"
import { PriceScheduleCombobox } from "@voyantjs/pricing-ui/components/price-schedule-combobox"
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
  Textarea,
} from "@voyantjs/ui/components"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { zodResolver } from "@/lib/zod-resolver"

const formSchema = z.object({
  ratePlanId: z.string().min(1, "Rate plan is required"),
  roomTypeId: z.string().min(1, "Room type is required"),
  priceScheduleId: z.string().optional().nullable(),
  currencyCode: z.string().length(3, "Currency must be 3 chars"),
  baseAmountCents: z.coerce.number().nullable().optional(),
  extraAdultAmountCents: z.coerce.number().nullable().optional(),
  extraChildAmountCents: z.coerce.number().nullable().optional(),
  extraInfantAmountCents: z.coerce.number().nullable().optional(),
  active: z.boolean(),
  notes: z.string().optional().nullable(),
})

type FormValues = z.input<typeof formSchema>
type FormOutput = z.output<typeof formSchema>

export type RoomTypeRateData = RoomTypeRateRecord

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
  roomTypeRate?: RoomTypeRateData
  onSuccess: () => void
}

function majorToCents(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(value)) return null
  return Math.round(value * 100)
}

export function RoomTypeRateDialog({
  open,
  onOpenChange,
  propertyId,
  roomTypeRate,
  onSuccess,
}: Props) {
  const isEditing = !!roomTypeRate
  const { create, update } = useRoomTypeRateMutation()

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ratePlanId: "",
      roomTypeId: "",
      priceScheduleId: "",
      currencyCode: "EUR",
      baseAmountCents: null,
      extraAdultAmountCents: null,
      extraChildAmountCents: null,
      extraInfantAmountCents: null,
      active: true,
      notes: "",
    },
  })

  const watchedRatePlanId = form.watch("ratePlanId")
  const { data: selectedRatePlan } = useRatePlan(watchedRatePlanId || null, {
    enabled: open && !!watchedRatePlanId,
  })

  const { data: schedulesData } = usePriceSchedules({
    priceCatalogId: selectedRatePlan?.priceCatalogId ?? undefined,
    limit: 25,
    enabled: open && !!selectedRatePlan?.priceCatalogId,
  })

  const priceSchedules = schedulesData?.data ?? []

  useEffect(() => {
    if (open && roomTypeRate) {
      form.reset({
        ratePlanId: roomTypeRate.ratePlanId,
        roomTypeId: roomTypeRate.roomTypeId,
        priceScheduleId: roomTypeRate.priceScheduleId ?? "",
        currencyCode: roomTypeRate.currencyCode,
        baseAmountCents:
          roomTypeRate.baseAmountCents != null ? roomTypeRate.baseAmountCents / 100 : null,
        extraAdultAmountCents:
          roomTypeRate.extraAdultAmountCents != null
            ? roomTypeRate.extraAdultAmountCents / 100
            : null,
        extraChildAmountCents:
          roomTypeRate.extraChildAmountCents != null
            ? roomTypeRate.extraChildAmountCents / 100
            : null,
        extraInfantAmountCents:
          roomTypeRate.extraInfantAmountCents != null
            ? roomTypeRate.extraInfantAmountCents / 100
            : null,
        active: roomTypeRate.active,
        notes: roomTypeRate.notes ?? "",
      })
    } else if (open) {
      form.reset({
        ratePlanId: "",
        roomTypeId: "",
        priceScheduleId: "",
        currencyCode: "EUR",
        baseAmountCents: null,
        extraAdultAmountCents: null,
        extraChildAmountCents: null,
        extraInfantAmountCents: null,
        active: true,
        notes: "",
      })
    }
  }, [open, roomTypeRate, form])

  const onSubmit = async (values: FormOutput) => {
    const payload = {
      ratePlanId: values.ratePlanId,
      roomTypeId: values.roomTypeId,
      priceScheduleId: values.priceScheduleId || null,
      currencyCode: values.currencyCode.toUpperCase(),
      baseAmountCents: majorToCents(values.baseAmountCents),
      extraAdultAmountCents: majorToCents(values.extraAdultAmountCents),
      extraChildAmountCents: majorToCents(values.extraChildAmountCents),
      extraInfantAmountCents: majorToCents(values.extraInfantAmountCents),
      active: values.active,
      notes: values.notes || null,
    }
    if (isEditing) {
      await update.mutateAsync({ id: roomTypeRate.id, input: payload })
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
          <DialogTitle>{isEditing ? "Edit Room Type Rate" : "Add Room Type Rate"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Rate Plan</Label>
                <RatePlanCombobox
                  propertyId={propertyId}
                  value={form.watch("ratePlanId")}
                  onChange={(value) => form.setValue("ratePlanId", value ?? "")}
                  placeholder="Select rate plan"
                  disabled={!open}
                />
                {form.formState.errors.ratePlanId && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.ratePlanId.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label>Room Type</Label>
                <RoomTypeCombobox
                  propertyId={propertyId}
                  value={form.watch("roomTypeId")}
                  onChange={(value) => form.setValue("roomTypeId", value ?? "")}
                  placeholder="Select room type"
                  disabled={!open}
                />
                {form.formState.errors.roomTypeId && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.roomTypeId.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Season (Price Schedule)</Label>
                <PriceScheduleCombobox
                  priceCatalogId={selectedRatePlan?.priceCatalogId}
                  value={form.watch("priceScheduleId")}
                  onChange={(value) => form.setValue("priceScheduleId", value ?? "")}
                  placeholder={
                    priceSchedules.length > 0 ? "Base / Default" : "Select rate plan first"
                  }
                  disabled={!open || !selectedRatePlan?.priceCatalogId}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Currency</Label>
                <Input {...form.register("currencyCode")} placeholder="EUR" maxLength={3} />
                {form.formState.errors.currencyCode && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.currencyCode.message}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Base rate per night</Label>
              <p className="text-xs text-muted-foreground">
                Covers up to the room type's standard occupancy
              </p>
              <Input
                {...form.register("baseAmountCents", { valueAsNumber: true })}
                type="number"
                step="0.01"
                placeholder="0.00"
              />
            </div>

            <p className="text-xs font-medium text-muted-foreground">Supplements per extra guest</p>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Extra Adult</Label>
                <Input
                  {...form.register("extraAdultAmountCents", { valueAsNumber: true })}
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Extra Child</Label>
                <Input
                  {...form.register("extraChildAmountCents", { valueAsNumber: true })}
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Extra Infant</Label>
                <Input
                  {...form.register("extraInfantAmountCents", { valueAsNumber: true })}
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Notes</Label>
              <Textarea {...form.register("notes")} />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.watch("active")}
                onCheckedChange={(v) => form.setValue("active", v)}
              />
              <Label>Active</Label>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Add Rate"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
