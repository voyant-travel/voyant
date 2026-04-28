"use client"

import { type PriceScheduleRecord, usePriceScheduleMutation } from "@voyantjs/pricing-react"
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
} from "@voyantjs/voyant-ui/components"
import { DatePicker } from "@voyantjs/voyant-ui/components/date-picker"
import { zodResolver } from "@voyantjs/voyant-ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"

import { PriceCatalogCombobox } from "./price-catalog-combobox"

const scheduleFormSchema = z.object({
  priceCatalogId: z.string().min(1, "Catalog is required"),
  name: z.string().min(1, "Name is required").max(255),
  code: z.string().max(100).optional().nullable(),
  recurrenceRule: z.string().min(1, "RRULE is required"),
  timezone: z.string().max(100).optional().nullable(),
  validFrom: z.string().optional().nullable(),
  validTo: z.string().optional().nullable(),
  priority: z.coerce.number().int(),
  active: z.boolean(),
  notes: z.string().optional().nullable(),
})

type ScheduleFormValues = z.input<typeof scheduleFormSchema>
type ScheduleFormOutput = z.output<typeof scheduleFormSchema>

export interface PriceScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  schedule?: PriceScheduleRecord
  onSuccess?: (schedule: PriceScheduleRecord) => void
}

export function PriceScheduleDialog({
  open,
  onOpenChange,
  schedule,
  onSuccess,
}: PriceScheduleDialogProps) {
  const isEditing = !!schedule
  const { create, update } = usePriceScheduleMutation()

  const form = useForm<ScheduleFormValues, unknown, ScheduleFormOutput>({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues: {
      priceCatalogId: "",
      name: "",
      code: "",
      recurrenceRule: "FREQ=YEARLY;BYMONTH=6,7,8",
      timezone: "",
      validFrom: "",
      validTo: "",
      priority: 0,
      active: true,
      notes: "",
    },
  })

  useEffect(() => {
    if (open && schedule) {
      form.reset({
        priceCatalogId: schedule.priceCatalogId,
        name: schedule.name,
        code: schedule.code ?? "",
        recurrenceRule: schedule.recurrenceRule,
        timezone: schedule.timezone ?? "",
        validFrom: schedule.validFrom ?? "",
        validTo: schedule.validTo ?? "",
        priority: schedule.priority,
        active: schedule.active,
        notes: schedule.notes ?? "",
      })
    } else if (open) {
      form.reset()
    }
  }, [open, schedule, form])

  const onSubmit = async (values: ScheduleFormOutput) => {
    const payload = {
      priceCatalogId: values.priceCatalogId,
      name: values.name,
      code: values.code || null,
      recurrenceRule: values.recurrenceRule,
      timezone: values.timezone || null,
      validFrom: values.validFrom || null,
      validTo: values.validTo || null,
      priority: values.priority,
      active: values.active,
      notes: values.notes || null,
    }

    const saved = isEditing
      ? await update.mutateAsync({ id: schedule.id, input: payload })
      : await create.mutateAsync(payload)

    onSuccess?.(saved)
    onOpenChange(false)
  }

  const validFrom = form.watch("validFrom")
  const validTo = form.watch("validTo")
  const isSubmitting = create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Price Schedule" : "New Price Schedule"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label>Catalog</Label>
              <PriceCatalogCombobox
                value={form.watch("priceCatalogId")}
                onChange={(value) =>
                  form.setValue("priceCatalogId", value ?? "", {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              />
              {form.formState.errors.priceCatalogId ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.priceCatalogId.message}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Name</Label>
                <Input {...form.register("name")} placeholder="High Season" />
                {form.formState.errors.name ? (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>Code</Label>
                <Input {...form.register("code")} placeholder="high-season" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Recurrence rule (RRULE)</Label>
              <Textarea
                {...form.register("recurrenceRule")}
                placeholder="FREQ=YEARLY;BYMONTH=6,7,8"
                rows={2}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                e.g. <code>FREQ=YEARLY;BYMONTH=6,7,8</code> for June-August.
              </p>
              {form.formState.errors.recurrenceRule ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.recurrenceRule.message}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Valid from</Label>
                <DatePicker
                  value={typeof validFrom === "string" && validFrom.length > 0 ? validFrom : null}
                  onChange={(value) =>
                    form.setValue("validFrom", value ?? "", { shouldDirty: true })
                  }
                  placeholder="Optional"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Valid to</Label>
                <DatePicker
                  value={typeof validTo === "string" && validTo.length > 0 ? validTo : null}
                  onChange={(value) => form.setValue("validTo", value ?? "", { shouldDirty: true })}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Timezone</Label>
                <Input {...form.register("timezone")} placeholder="Europe/Istanbul" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Priority</Label>
                <Input {...form.register("priority")} type="number" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.watch("active")}
                onCheckedChange={(checked) => form.setValue("active", checked)}
              />
              <Label>Active</Label>
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
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditing ? "Save Changes" : "Create Schedule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
