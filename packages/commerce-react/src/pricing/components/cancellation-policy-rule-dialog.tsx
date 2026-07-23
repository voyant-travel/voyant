"use client"

import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Switch,
  Textarea,
} from "@voyant-travel/ui/components"
import { zodResolver } from "@voyant-travel/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import type { ChargeType } from "../i18n/messages.js"
import { usePricingUiMessagesOrDefault } from "../i18n/provider.js"
import { type CancellationPolicyRuleRecord, useCancellationPolicyRuleMutation } from "../index.js"

function createRuleFormSchema(_messages: ReturnType<typeof usePricingUiMessagesOrDefault>) {
  return z.object({
    sortOrder: z.coerce.number().int(),
    cutoffMinutesBefore: z.coerce.number().int().min(0).optional().or(z.literal("")).nullable(),
    chargeType: z.enum(["none", "amount", "percentage"]),
    chargeAmount: z.coerce.number().min(0).optional().or(z.literal("")).nullable(),
    chargePercent: z.coerce.number().min(0).max(100).optional().or(z.literal("")).nullable(),
    active: z.boolean(),
    notes: z.string().optional().nullable(),
  })
}

type RuleFormSchema = ReturnType<typeof createRuleFormSchema>
type RuleFormValues = z.input<RuleFormSchema>
type RuleFormOutput = z.output<RuleFormSchema>

export interface CancellationPolicyRuleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  policyId: string
  rule?: CancellationPolicyRuleRecord
  nextSortOrder?: number
  onSuccess?: (rule: CancellationPolicyRuleRecord) => void
}

const CHARGE_TYPES = [{ value: "none" }, { value: "amount" }, { value: "percentage" }] as const

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
  const messages = usePricingUiMessagesOrDefault()
  const ruleFormSchema = createRuleFormSchema(messages)

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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>
            {isEditing
              ? messages.cancellationPolicyRuleDialog.titles.edit
              : messages.cancellationPolicyRuleDialog.titles.create}
          </SheetTitle>
        </SheetHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <SheetBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.cancellationPolicyRuleDialog.fields.cutoffMinutesBefore}</Label>
                <Input
                  {...form.register("cutoffMinutesBefore")}
                  type="number"
                  min="0"
                  placeholder={
                    messages.cancellationPolicyRuleDialog.placeholders.cutoffMinutesBefore
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {messages.cancellationPolicyRuleDialog.helpText.cutoffMinutesBefore}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.cancellationPolicyRuleDialog.fields.sortOrder}</Label>
                <Input {...form.register("sortOrder")} type="number" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.cancellationPolicyRuleDialog.fields.chargeType}</Label>
              <Select
                items={CHARGE_TYPES.map((type) => ({
                  label: messages.common.chargeTypeLabels[type.value as ChargeType],
                  value: type.value,
                }))}
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
                      {messages.common.chargeTypeLabels[type.value as ChargeType]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {chargeType === "amount" ? (
              <div className="flex flex-col gap-2">
                <Label>{messages.cancellationPolicyRuleDialog.fields.chargeAmount}</Label>
                <Input {...form.register("chargeAmount")} type="number" step="0.01" min="0" />
              </div>
            ) : null}

            {chargeType === "percentage" ? (
              <div className="flex flex-col gap-2">
                <Label>{messages.cancellationPolicyRuleDialog.fields.chargePercent}</Label>
                <Input
                  {...form.register("chargePercent")}
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder={messages.cancellationPolicyRuleDialog.placeholders.chargePercent}
                />
              </div>
            ) : null}

            <div className="flex items-center gap-2">
              <Switch
                checked={form.watch("active")}
                onCheckedChange={(checked) => form.setValue("active", checked)}
              />
              <Label>{messages.cancellationPolicyRuleDialog.fields.active}</Label>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.cancellationPolicyRuleDialog.fields.notes}</Label>
              <Textarea {...form.register("notes")} />
            </div>
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditing
                ? messages.common.saveChanges
                : messages.cancellationPolicyRuleDialog.actions.create}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
