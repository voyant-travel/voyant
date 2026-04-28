import { RATE_UNITS, type SupplierRate, useSupplierRateMutation } from "@voyantjs/suppliers-react"
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
import { useAdminMessages } from "@/lib/admin-i18n"
import { zodResolver } from "@/lib/zod-resolver"

const getRateFormSchema = (messages: ReturnType<typeof useAdminMessages>) =>
  z.object({
    name: z.string().min(1, messages.suppliers.dialogs.rate.validationNameRequired),
    currency: z
      .string()
      .min(3, messages.suppliers.dialogs.rate.validationIsoCurrency)
      .max(3, messages.suppliers.dialogs.rate.validationIsoCurrency),
    amount: z.coerce.number().min(0, messages.suppliers.dialogs.rate.validationNonNegative),
    unit: z.enum(["per_person", "per_group", "per_night", "per_vehicle", "flat"]),
    validFrom: z.string().optional().nullable(),
    validTo: z.string().optional().nullable(),
    minPax: z.coerce.number().int().positive().optional().or(z.literal("")).nullable(),
    maxPax: z.coerce.number().int().positive().optional().or(z.literal("")).nullable(),
    notes: z.string().optional().nullable(),
  })

export type RateData = SupplierRate

export type RateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplierId: string
  serviceId: string
  rate?: RateData
  onSuccess: () => void
}

export function RateDialog({
  open,
  onOpenChange,
  supplierId,
  serviceId,
  rate,
  onSuccess,
}: RateDialogProps) {
  const isEditing = !!rate
  const rateMutation = useSupplierRateMutation(supplierId)
  const messages = useAdminMessages()
  const dialogMessages = messages.suppliers.dialogs.rate
  const rateFormSchema = getRateFormSchema(messages)

  const form = useForm<z.input<typeof rateFormSchema>, unknown, z.output<typeof rateFormSchema>>({
    resolver: zodResolver(rateFormSchema),
    defaultValues: {
      name: "",
      currency: "EUR",
      amount: 0,
      unit: "per_person",
      validFrom: "",
      validTo: "",
      minPax: "",
      maxPax: "",
      notes: "",
    },
  })

  useEffect(() => {
    if (open && rate) {
      form.reset({
        name: rate.name,
        currency: rate.currency,
        amount: rate.amountCents / 100,
        unit: rate.unit,
        validFrom: rate.validFrom ?? "",
        validTo: rate.validTo ?? "",
        minPax: rate.minPax ?? "",
        maxPax: rate.maxPax ?? "",
        notes: rate.notes ?? "",
      })
    } else if (open) {
      form.reset()
    }
  }, [open, rate, form])

  const onSubmit = async (values: z.output<typeof rateFormSchema>) => {
    const payload = {
      name: values.name,
      currency: values.currency,
      amountCents: Math.round(values.amount * 100),
      unit: values.unit,
      validFrom: values.validFrom || null,
      validTo: values.validTo || null,
      minPax: values.minPax && typeof values.minPax === "number" ? values.minPax : null,
      maxPax: values.maxPax && typeof values.maxPax === "number" ? values.maxPax : null,
      notes: values.notes || null,
    }

    if (isEditing) {
      await rateMutation.update.mutateAsync({ serviceId, rateId: rate.id, input: payload })
    } else {
      await rateMutation.create.mutateAsync({ serviceId, input: payload })
    }
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? dialogMessages.editTitle : dialogMessages.newTitle}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label>{dialogMessages.seasonNameLabel}</Label>
              <Input
                {...form.register("name")}
                placeholder={dialogMessages.seasonNamePlaceholder}
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.currencyLabel}</Label>
                <Input
                  {...form.register("currency")}
                  placeholder={dialogMessages.currencyPlaceholder}
                  maxLength={3}
                  className="uppercase"
                />
                {form.formState.errors.currency && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.currency.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.amountLabel}</Label>
                <Input
                  {...form.register("amount")}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={dialogMessages.amountPlaceholder}
                />
                {form.formState.errors.amount && (
                  <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.unitLabel}</Label>
                <Select
                  items={RATE_UNITS}
                  value={form.watch("unit")}
                  onValueChange={(v) =>
                    form.setValue("unit", v as z.input<typeof rateFormSchema>["unit"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RATE_UNITS.map((u) => (
                      <SelectItem key={u.value} value={u.value}>
                        {messages.suppliers.rateUnitLabels[u.value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.validFromLabel}</Label>
                <Input {...form.register("validFrom")} type="date" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.validToLabel}</Label>
                <Input {...form.register("validTo")} type="date" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.minPaxLabel}</Label>
                <Input
                  {...form.register("minPax")}
                  type="number"
                  min="1"
                  placeholder={dialogMessages.minPaxPlaceholder}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.maxPaxLabel}</Label>
                <Input
                  {...form.register("maxPax")}
                  type="number"
                  min="1"
                  placeholder={dialogMessages.maxPaxPlaceholder}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{dialogMessages.notesLabel}</Label>
              <Textarea {...form.register("notes")} placeholder={dialogMessages.notesPlaceholder} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {dialogMessages.cancel}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? dialogMessages.save : dialogMessages.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
