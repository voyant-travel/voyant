import { type LegalPolicyRuleRecord, useLegalPolicyRuleMutation } from "@voyantjs/legal-react"
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
} from "@voyantjs/ui/components"
import { CurrencyCombobox } from "@voyantjs/ui/components/currency-combobox"
import { zodResolver } from "@voyantjs/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"

const ruleFormSchema = z.object({
  ruleType: z.enum(["window", "percentage", "flat_amount", "date_range", "custom"]),
  label: z.string().optional(),
  daysBeforeDeparture: z.coerce.number().int().optional(),
  refundPercent: z.coerce.number().int().min(0).max(10000).optional(),
  refundType: z.enum(["cash", "credit", "cash_or_credit", "none"]).optional(),
  flatAmountCents: z.coerce.number().int().optional(),
  currency: z.string().optional(),
  sortOrder: z.coerce.number().int().optional(),
})

type FormValues = z.input<typeof ruleFormSchema>
type FormOutput = z.output<typeof ruleFormSchema>

export type RuleData = LegalPolicyRuleRecord

type PolicyRuleDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  versionId: string
  rule?: RuleData
  onSuccess: () => void
}

const RULE_TYPES = [
  { value: "window", label: "Window" },
  { value: "percentage", label: "Percentage" },
  { value: "flat_amount", label: "Flat Amount" },
  { value: "date_range", label: "Date Range" },
  { value: "custom", label: "Custom" },
] as const

const REFUND_TYPES = [
  { value: "cash", label: "Cash" },
  { value: "credit", label: "Credit" },
  { value: "cash_or_credit", label: "Cash or Credit" },
  { value: "none", label: "None" },
] as const

export function PolicyRuleDialog({
  open,
  onOpenChange,
  versionId,
  rule,
  onSuccess,
}: PolicyRuleDialogProps) {
  const isEditing = !!rule
  const { create, update } = useLegalPolicyRuleMutation()

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(ruleFormSchema),
    defaultValues: {
      ruleType: "window",
      label: "",
      daysBeforeDeparture: undefined,
      refundPercent: undefined,
      refundType: undefined,
      flatAmountCents: undefined,
      currency: "",
      sortOrder: 0,
    },
  })

  useEffect(() => {
    if (open && rule) {
      form.reset({
        ruleType: rule.ruleType as FormValues["ruleType"],
        label: rule.label ?? "",
        daysBeforeDeparture: rule.daysBeforeDeparture ?? undefined,
        refundPercent: rule.refundPercent ?? undefined,
        refundType: (rule.refundType as FormValues["refundType"]) ?? undefined,
        flatAmountCents: rule.flatAmountCents ?? undefined,
        currency: rule.currency ?? "",
        sortOrder: rule.sortOrder,
      })
    } else if (open) {
      form.reset()
    }
  }, [open, rule, form])

  const onSubmit = async (values: FormOutput) => {
    const payload = {
      ruleType: values.ruleType,
      label: values.label || undefined,
      daysBeforeDeparture: values.daysBeforeDeparture,
      refundPercent: values.refundPercent,
      refundType: values.refundType || undefined,
      flatAmountCents: values.flatAmountCents,
      currency: values.currency || undefined,
      sortOrder: values.sortOrder ?? 0,
    }

    if (isEditing && rule) {
      await update.mutateAsync({ id: rule.id, input: payload })
    } else {
      await create.mutateAsync({ versionId, input: payload })
    }
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Rule" : "New Rule"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Rule Type</Label>
                <Select
                  items={RULE_TYPES}
                  value={form.watch("ruleType")}
                  onValueChange={(v) => form.setValue("ruleType", v as FormValues["ruleType"])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RULE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Sort Order</Label>
                <Input {...form.register("sortOrder")} type="number" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Label</Label>
              <Input {...form.register("label")} placeholder="e.g. 30+ days before departure" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Days Before Departure</Label>
                <Input
                  {...form.register("daysBeforeDeparture")}
                  type="number"
                  placeholder="e.g. 30"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Refund Percent (basis points)</Label>
                <Input
                  {...form.register("refundPercent")}
                  type="number"
                  placeholder="e.g. 10000 = 100%"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Refund Type</Label>
                <Select
                  items={REFUND_TYPES}
                  value={form.watch("refundType") ?? ""}
                  onValueChange={(v) =>
                    form.setValue("refundType", (v || undefined) as FormValues["refundType"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {REFUND_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Currency</Label>
                <CurrencyCombobox
                  value={form.watch("currency") || null}
                  onChange={(next) =>
                    form.setValue("currency", next ?? "EUR", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Flat Amount (cents)</Label>
              <Input {...form.register("flatAmountCents")} type="number" placeholder="e.g. 5000" />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Create Rule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
