"use client"

import {
  type CancellationPolicyRuleRecord,
  useCancellationPolicyRuleMutation,
} from "@voyantjs/pricing-react"
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
} from "@voyantjs/voyant-ui/components"
import { zodResolver } from "@voyantjs/voyant-ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"

const ruleFormSchema = z.object({
  sortOrder: z.coerce.number().int(),
  cutoffMinutesBefore: z.coerce.number().int().min(0).optional().or(z.literal("")).nullable(),
  chargeType: z.enum(["none", "amount", "percentage"]),
  chargeAmount: z.coerce.number().min(0).optional().or(z.literal("")).nullable(),
  chargePercent: z.coerce.number().min(0).max(100).optional().or(z.literal("")).nullable(),
  active: z.boolean(),
  notes: z.string().optional().nullable(),
})

type RuleFormValues = z.input<typeof ruleFormSchema>
type RuleFormOutput = z.output<typeof ruleFormSchema>

export interface CancellationPolicyRuleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  policyId: string
  rule?: CancellationPolicyRuleRecord
  nextSortOrder?: number
  onSuccess?: (rule: CancellationPolicyRuleRecord) => void
}

const CHARGE_TYPES = [
  { value: "none", label: "None" },
  { value: "amount", label: "Amount" },
  { value: "percentage", label: "Percentage" },
] as const

export function CancellationPolicyRuleDialog({
  open,
  onOpenChange,
  policyId,
  rule,
  nextSortOrder,
  onSuccess,
}: CancellationPolicyRuleDialogProps) {
  const isEditing = !!rule
  const { create, update } = useCancellationPolicyRuleMutation()

  const form = useForm<RuleFormValues, unknown, RuleFormOutput>({
    resolver: zodResolver(ruleFormSchema),
    defaultValues: {
      sortOrder: 0,
      cutoffMinutesBefore: "",
      chargeType: "percentage",
      chargeAmount: "",
      chargePercent: "",
      active: true,
      notes: "",
    },
  })

  useEffect(() => {
    if (open && rule) {
      form.reset({
        sortOrder: rule.sortOrder,
        cutoffMinutesBefore: rule.cutoffMinutesBefore ?? "",
        chargeType: rule.chargeType,
        chargeAmount: rule.chargeAmountCents != null ? rule.chargeAmountCents / 100 : "",
        chargePercent:
          rule.chargePercentBasisPoints != null ? rule.chargePercentBasisPoints / 100 : "",
        active: rule.active,
        notes: rule.notes ?? "",
      })
    } else if (open) {
      form.reset({
        sortOrder: nextSortOrder ?? 0,
        cutoffMinutesBefore: "",
        chargeType: "percentage",
        chargeAmount: "",
        chargePercent: "",
        active: true,
        notes: "",
      })
    }
  }, [open, rule, nextSortOrder, form])

  const chargeType = form.watch("chargeType")

  const onSubmit = async (values: RuleFormOutput) => {
    const payload = {
      cancellationPolicyId: policyId,
      sortOrder: values.sortOrder,
      cutoffMinutesBefore:
        typeof values.cutoffMinutesBefore === "number" ? values.cutoffMinutesBefore : null,
      chargeType: values.chargeType,
      chargeAmountCents:
        values.chargeType === "amount" && typeof values.chargeAmount === "number"
          ? Math.round(values.chargeAmount * 100)
          : null,
      chargePercentBasisPoints:
        values.chargeType === "percentage" && typeof values.chargePercent === "number"
          ? Math.round(values.chargePercent * 100)
          : null,
      active: values.active,
      notes: values.notes || null,
    }

    const saved = isEditing
      ? await update.mutateAsync({ id: rule.id, input: payload })
      : await create.mutateAsync(payload)

    onSuccess?.(saved)
    onOpenChange(false)
  }

  const isSubmitting = create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Rule" : "Add Rule"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Cutoff (minutes before)</Label>
                <Input
                  {...form.register("cutoffMinutesBefore")}
                  type="number"
                  min="0"
                  placeholder="2880"
                />
                <p className="text-xs text-muted-foreground">48h = 2880m · 24h = 1440m</p>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Sort order</Label>
                <Input {...form.register("sortOrder")} type="number" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Charge type</Label>
              <Select
                items={CHARGE_TYPES}
                value={form.watch("chargeType")}
                onValueChange={(value) =>
                  form.setValue("chargeType", value as RuleFormValues["chargeType"])
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHARGE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {chargeType === "amount" ? (
              <div className="flex flex-col gap-2">
                <Label>Charge amount</Label>
                <Input {...form.register("chargeAmount")} type="number" step="0.01" min="0" />
              </div>
            ) : null}

            {chargeType === "percentage" ? (
              <div className="flex flex-col gap-2">
                <Label>Charge percent (0-100)</Label>
                <Input
                  {...form.register("chargePercent")}
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="50"
                />
              </div>
            ) : null}

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
              {isEditing ? "Save Changes" : "Add Rule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
