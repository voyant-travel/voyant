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
import type { UnitPricingMode } from "../i18n/messages.js"
import { usePricingUiMessagesOrDefault } from "../i18n/provider.js"
import { type OptionUnitPriceRuleRecord, useOptionUnitPriceRuleMutation } from "../index.js"
import { OptionPriceRuleCombobox } from "./option-price-rule-combobox.js"
import { OptionUnitCombobox } from "./option-unit-combobox.js"
import { PricingCategoryCombobox } from "./pricing-category-combobox.js"
import { ProductOptionCombobox } from "./product-option-combobox.js"

const PRICING_MODES = [
  "per_unit",
  "per_person",
  "per_booking",
  "included",
  "free",
  "on_request",
] as const
type PricingMode = (typeof PRICING_MODES)[number]

function createFormSchema(messages: ReturnType<typeof usePricingUiMessagesOrDefault>) {
  return z.object({
    optionPriceRuleId: z
      .string()
      .min(1, messages.optionUnitPriceRuleDialog.validation.optionPriceRuleRequired),
    optionId: z.string().min(1, messages.optionUnitPriceRuleDialog.validation.optionRequired),
    unitId: z.string().min(1, messages.optionUnitPriceRuleDialog.validation.unitRequired),
    pricingCategoryId: z.string().optional().nullable(),
    pricingMode: z.enum(PRICING_MODES),
    sellAmount: z.coerce.number().min(0).optional().or(z.literal("")).nullable(),
    costAmount: z.coerce.number().min(0).optional().or(z.literal("")).nullable(),
    minQuantity: z.coerce.number().int().min(0).optional().or(z.literal("")).nullable(),
    maxQuantity: z.coerce.number().int().min(0).optional().or(z.literal("")).nullable(),
    sortOrder: z.coerce.number().int(),
    active: z.boolean(),
    notes: z.string().optional().nullable(),
  })
}

type FormSchema = ReturnType<typeof createFormSchema>
type FormValues = z.input<FormSchema>
type FormOutput = z.output<FormSchema>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule?: OptionUnitPriceRuleRecord
  onSuccess?: (rule: OptionUnitPriceRuleRecord) => void
}

const toInt = (value: number | "" | null | undefined): number | null =>
  typeof value === "number" ? value : null
const toCents = (value: number | "" | null | undefined): number | null =>
  typeof value === "number" ? Math.round(value * 100) : null

export function OptionUnitPriceRuleDialog({ open, onOpenChange, rule, onSuccess }: Props) {
  const isEditing = !!rule
  const { create, update } = useOptionUnitPriceRuleMutation()
  const messages = usePricingUiMessagesOrDefault()
  const formSchema = createFormSchema(messages)

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      optionPriceRuleId: "",
      optionId: "",
      unitId: "",
      pricingCategoryId: "",
      pricingMode: "per_unit",
      sellAmount: "",
      costAmount: "",
      minQuantity: "",
      maxQuantity: "",
      sortOrder: 0,
      active: true,
      notes: "",
    },
  })

  useEffect(() => {
    if (open && rule) {
      form.reset({
        optionPriceRuleId: rule.optionPriceRuleId,
        optionId: rule.optionId,
        unitId: rule.unitId,
        pricingCategoryId: rule.pricingCategoryId ?? "",
        pricingMode: rule.pricingMode,
        sellAmount: rule.sellAmountCents != null ? rule.sellAmountCents / 100 : "",
        costAmount: rule.costAmountCents != null ? rule.costAmountCents / 100 : "",
        minQuantity: rule.minQuantity ?? "",
        maxQuantity: rule.maxQuantity ?? "",
        sortOrder: rule.sortOrder,
        active: rule.active,
        notes: rule.notes ?? "",
      })
    } else if (open) {
      form.reset()
    }
  }, [open, rule, form])

  const onSubmit = async (values: FormOutput) => {
    const payload = {
      optionPriceRuleId: values.optionPriceRuleId,
      optionId: values.optionId,
      unitId: values.unitId,
      pricingCategoryId: values.pricingCategoryId || null,
      pricingMode: values.pricingMode,
      sellAmountCents: toCents(values.sellAmount),
      costAmountCents: toCents(values.costAmount),
      minQuantity: toInt(values.minQuantity),
      maxQuantity: toInt(values.maxQuantity),
      sortOrder: values.sortOrder,
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
  const selectedOptionId = form.watch("optionId")

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="lg">
        <SheetHeader>
          <SheetTitle>
            {isEditing
              ? messages.optionUnitPriceRuleDialog.titles.edit
              : messages.optionUnitPriceRuleDialog.titles.create}
          </SheetTitle>
        </SheetHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <SheetBody className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label>{messages.optionUnitPriceRuleDialog.fields.optionPriceRule}</Label>
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
                <Label>{messages.optionUnitPriceRuleDialog.fields.option}</Label>
                <ProductOptionCombobox
                  value={selectedOptionId}
                  onChange={(value) => {
                    form.setValue("optionId", value ?? "", {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                    form.setValue("unitId", "", { shouldDirty: true, shouldValidate: true })
                  }}
                  requireProduct={false}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.optionUnitPriceRuleDialog.fields.unit}</Label>
                <OptionUnitCombobox
                  optionId={selectedOptionId}
                  value={form.watch("unitId")}
                  onChange={(value) =>
                    form.setValue("unitId", value ?? "", {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.optionUnitPriceRuleDialog.fields.pricingCategory}</Label>
                <PricingCategoryCombobox
                  value={form.watch("pricingCategoryId")}
                  onChange={(value) =>
                    form.setValue("pricingCategoryId", value ?? "", { shouldDirty: true })
                  }
                  placeholder={messages.optionUnitPriceRuleDialog.placeholders.pricingCategory}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.optionUnitPriceRuleDialog.fields.pricingMode}</Label>
                <Select
                  items={PRICING_MODES.map((mode) => ({
                    label: messages.common.unitPricingModeLabels[mode as UnitPricingMode],
                    value: mode,
                  }))}
                  value={form.watch("pricingMode")}
                  onValueChange={(value) => form.setValue("pricingMode", value as PricingMode)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRICING_MODES.map((mode) => (
                      <SelectItem key={mode} value={mode}>
                        {messages.common.unitPricingModeLabels[mode as UnitPricingMode]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.optionUnitPriceRuleDialog.fields.sellAmount}</Label>
                <Input {...form.register("sellAmount")} type="number" step="0.01" min="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.optionUnitPriceRuleDialog.fields.costAmount}</Label>
                <Input {...form.register("costAmount")} type="number" step="0.01" min="0" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-2">
                <Label>{messages.optionUnitPriceRuleDialog.fields.minQuantity}</Label>
                <Input {...form.register("minQuantity")} type="number" min="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.optionUnitPriceRuleDialog.fields.maxQuantity}</Label>
                <Input {...form.register("maxQuantity")} type="number" min="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.optionUnitPriceRuleDialog.fields.sortOrder}</Label>
                <Input {...form.register("sortOrder")} type="number" />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={form.watch("active")}
                onCheckedChange={(checked) => form.setValue("active", checked)}
              />
              <Label>{messages.optionUnitPriceRuleDialog.fields.active}</Label>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.optionUnitPriceRuleDialog.fields.notes}</Label>
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
                : messages.optionUnitPriceRuleDialog.actions.create}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
