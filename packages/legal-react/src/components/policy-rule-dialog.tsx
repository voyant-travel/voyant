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
} from "@voyant-travel/ui/components"
import { CurrencyCombobox } from "@voyant-travel/ui/components/currency-combobox"
import { CurrencyInput } from "@voyant-travel/ui/components/currency-input"
import { zodResolver } from "@voyant-travel/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { useLegalUiMessagesOrDefault } from "../i18n/index.js"
import {
  type LegalRefundType,
  type LegalRuleType,
  legalRefundTypes,
  legalRuleTypes,
} from "../i18n/messages.js"
import { type LegalPolicyRuleRecord, useLegalPolicyRuleMutation } from "../index.js"

function createRuleFormSchema(messages: ReturnType<typeof useLegalUiMessagesOrDefault>) {
  return z.object({
    ruleType: z.enum(legalRuleTypes),
    label: z.string().optional(),
    daysBeforeDeparture: z.coerce.number().int().optional(),
    refundPercent: z.coerce
      .number()
      .min(0, messages.policyRuleDialog.validation.refundPercentMin)
      .max(100, messages.policyRuleDialog.validation.refundPercentMax)
      .optional(),
    refundType: z.enum(legalRefundTypes).optional(),
    flatAmountCents: z.coerce.number().int().optional(),
    currency: z.string().optional(),
    sortOrder: z.coerce.number().int().optional(),
  })
}

type RuleFormSchema = ReturnType<typeof createRuleFormSchema>
type FormValues = z.input<RuleFormSchema>
type FormOutput = z.output<RuleFormSchema>

export type RuleData = LegalPolicyRuleRecord

type PolicyRuleDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  versionId: string
  rule?: RuleData
  onSuccess: () => void
}

export function PolicyRuleDialog({
  open,
  onOpenChange,
  versionId,
  rule,
  onSuccess,
}: PolicyRuleDialogProps) {
  const isEditing = !!rule
  const { create, update } = useLegalPolicyRuleMutation()
  const messages = useLegalUiMessagesOrDefault()
  const ruleFormSchema = createRuleFormSchema(messages)
  const ruleTypeItems = legalRuleTypes.map((value) => ({
    value,
    label: messages.policyRuleDialog.ruleTypeLabels[value],
  }))
  const refundTypeItems = legalRefundTypes.map((value) => ({
    value,
    label: messages.policyRuleDialog.refundTypeLabels[value],
  }))

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
        refundPercent: rule.refundPercent != null ? rule.refundPercent / 100 : undefined,
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
      refundPercent:
        values.refundPercent != null ? Math.round(values.refundPercent * 100) : undefined,
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>
            {isEditing
              ? messages.policyRuleDialog.titles.edit
              : messages.policyRuleDialog.titles.create}
          </SheetTitle>
        </SheetHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <SheetBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.policyRuleDialog.fields.ruleType}</Label>
                <Select
                  items={ruleTypeItems}
                  value={form.watch("ruleType")}
                  onValueChange={(v) =>
                    form.setValue("ruleType", v as LegalRuleType, { shouldValidate: true })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ruleTypeItems.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.policyRuleDialog.fields.sortOrder}</Label>
                <Input {...form.register("sortOrder")} type="number" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.policyRuleDialog.fields.label}</Label>
              <Input
                {...form.register("label")}
                placeholder={messages.policyRuleDialog.placeholders.label}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.policyRuleDialog.fields.daysBeforeDeparture}</Label>
                <Input
                  {...form.register("daysBeforeDeparture")}
                  type="number"
                  placeholder={messages.policyRuleDialog.placeholders.daysBeforeDeparture}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.policyRuleDialog.fields.refundPercent}</Label>
                <Input
                  {...form.register("refundPercent")}
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  placeholder={messages.policyRuleDialog.placeholders.refundPercent}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.policyRuleDialog.fields.refundType}</Label>
                <Select
                  items={refundTypeItems}
                  value={form.watch("refundType") ?? ""}
                  onValueChange={(v) =>
                    form.setValue("refundType", (v || undefined) as LegalRefundType | undefined)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={messages.common.selectPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {refundTypeItems.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.policyRuleDialog.fields.currency}</Label>
                <CurrencyCombobox
                  value={form.watch("currency") || null}
                  onChange={(next) =>
                    form.setValue(
                      "currency",
                      next ?? "EUR" /* i18n-literal-ok domain default currency */,
                      {
                        shouldValidate: true,
                        shouldDirty: true,
                      },
                    )
                  }
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.policyRuleDialog.fields.flatAmountCents}</Label>
              <CurrencyInput
                value={form.watch("flatAmountCents") as number | undefined}
                onChange={(next) =>
                  form.setValue("flatAmountCents", next ?? undefined, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                currency={form.watch("currency")}
                placeholder={messages.policyRuleDialog.placeholders.flatAmountCents}
              />
            </div>
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? messages.common.saveChanges : messages.policyRuleDialog.actions.create}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
