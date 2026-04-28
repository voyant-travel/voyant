"use client"

import {
  type OptionStartTimeRuleRecord,
  useOptionStartTimeRuleMutation,
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

import { OptionPriceRuleCombobox } from "./option-price-rule-combobox"

const RULE_MODES = ["included", "excluded", "override", "adjustment"] as const
type RuleMode = (typeof RULE_MODES)[number]

const ADJUSTMENT_TYPES = ["fixed", "percentage"] as const
type AdjustmentType = (typeof ADJUSTMENT_TYPES)[number]

const formSchema = z.object({
  optionPriceRuleId: z.string().min(1, "Option price rule is required"),
  optionId: z.string().min(1, "Option ID is required"),
  startTimeId: z.string().min(1, "Start time ID is required"),
  ruleMode: z.enum(RULE_MODES),
  adjustmentType: z.enum(ADJUSTMENT_TYPES).optional().nullable(),
  sellAdjustment: z.coerce.number().min(0).optional().or(z.literal("")).nullable(),
  costAdjustment: z.coerce.number().min(0).optional().or(z.literal("")).nullable(),
  adjustmentPercent: z.coerce.number().min(0).max(100).optional().or(z.literal("")).nullable(),
  active: z.boolean(),
  notes: z.string().optional().nullable(),
})

type FormValues = z.input<typeof formSchema>
type FormOutput = z.output<typeof formSchema>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule?: OptionStartTimeRuleRecord
  onSuccess?: (rule: OptionStartTimeRuleRecord) => void
}

const toCents = (value: number | "" | null | undefined): number | null =>
  typeof value === "number" ? Math.round(value * 100) : null
const toBasisPoints = (value: number | "" | null | undefined): number | null =>
  typeof value === "number" ? Math.round(value * 100) : null

export function OptionStartTimeRuleDialog({ open, onOpenChange, rule, onSuccess }: Props) {
  const isEditing = !!rule
  const { create, update } = useOptionStartTimeRuleMutation()

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      optionPriceRuleId: "",
      optionId: "",
      startTimeId: "",
      ruleMode: "included",
      adjustmentType: null,
      sellAdjustment: "",
      costAdjustment: "",
      adjustmentPercent: "",
      active: true,
      notes: "",
    },
  })

  useEffect(() => {
    if (open && rule) {
      form.reset({
        optionPriceRuleId: rule.optionPriceRuleId,
        optionId: rule.optionId,
        startTimeId: rule.startTimeId,
        ruleMode: rule.ruleMode,
        adjustmentType: rule.adjustmentType,
        sellAdjustment: rule.sellAdjustmentCents != null ? rule.sellAdjustmentCents / 100 : "",
        costAdjustment: rule.costAdjustmentCents != null ? rule.costAdjustmentCents / 100 : "",
        adjustmentPercent:
          rule.adjustmentBasisPoints != null ? rule.adjustmentBasisPoints / 100 : "",
        active: rule.active,
        notes: rule.notes ?? "",
      })
    } else if (open) {
      form.reset()
    }
  }, [form, open, rule])

  const watchedMode = form.watch("ruleMode")
  const showAdjustment = watchedMode === "adjustment" || watchedMode === "override"

  const onSubmit = async (values: FormOutput) => {
    const payload = {
      optionPriceRuleId: values.optionPriceRuleId,
      optionId: values.optionId,
      startTimeId: values.startTimeId,
      ruleMode: values.ruleMode,
      adjustmentType: showAdjustment ? values.adjustmentType || null : null,
      sellAdjustmentCents: showAdjustment ? toCents(values.sellAdjustment) : null,
      costAdjustmentCents: showAdjustment ? toCents(values.costAdjustment) : null,
      adjustmentBasisPoints: showAdjustment ? toBasisPoints(values.adjustmentPercent) : null,
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
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Start Time Rule" : "Add Start Time Rule"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label>Option price rule</Label>
              <OptionPriceRuleCombobox
                value={form.watch("optionPriceRuleId")}
                onChange={(value) =>
                  form.setValue("optionPriceRuleId", value ?? "", {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                disabled={isEditing}
              />
              {form.formState.errors.optionPriceRuleId ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.optionPriceRuleId.message}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Option ID</Label>
                <Input {...form.register("optionId")} placeholder="popt_…" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Start time ID</Label>
                <Input {...form.register("startTimeId")} placeholder="pst_…" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Rule mode</Label>
                <Select
                  items={RULE_MODES.map((x) => ({ label: x.replace(/_/g, " "), value: x }))}
                  value={form.watch("ruleMode")}
                  onValueChange={(value) => form.setValue("ruleMode", value as RuleMode)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RULE_MODES.map((mode) => (
                      <SelectItem key={mode} value={mode} className="capitalize">
                        {mode.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {showAdjustment ? (
                <div className="flex flex-col gap-2">
                  <Label>Adjustment type</Label>
                  <Select
                    items={ADJUSTMENT_TYPES.map((x) => ({ label: x.replace(/_/g, " "), value: x }))}
                    value={form.watch("adjustmentType") ?? ""}
                    onValueChange={(value) =>
                      form.setValue("adjustmentType", (value || null) as AdjustmentType | null)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {ADJUSTMENT_TYPES.map((type) => (
                        <SelectItem key={type} value={type} className="capitalize">
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>

            {showAdjustment ? (
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-2">
                  <Label>Sell adjustment</Label>
                  <Input {...form.register("sellAdjustment")} type="number" step="0.01" min="0" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Cost adjustment</Label>
                  <Input {...form.register("costAdjustment")} type="number" step="0.01" min="0" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Adjustment (%)</Label>
                  <Input
                    {...form.register("adjustmentPercent")}
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                  />
                </div>
              </div>
            ) : null}

            <div className="flex items-center gap-3">
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
