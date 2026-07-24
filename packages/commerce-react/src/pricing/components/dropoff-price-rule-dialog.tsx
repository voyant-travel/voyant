"use client"

import { ProductFacilityCombobox } from "@voyant-travel/inventory-react/ui"
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
import { usePricingUiMessagesOrDefault } from "../i18n/provider.js"
import { type DropoffPriceRuleRecord, useDropoffPriceRuleMutation } from "../index.js"
import { OptionPriceRuleCombobox } from "./option-price-rule-combobox.js"
import { ProductOptionCombobox } from "./product-option-combobox.js"

const ADDON_PRICING_MODES = [
  "included",
  "per_person",
  "per_booking",
  "on_request",
  "unavailable",
] as const
function createFormSchema(messages: ReturnType<typeof usePricingUiMessagesOrDefault>) {
  return z.object({
    optionPriceRuleId: z
      .string()
      .min(1, messages.locationPriceRuleDialog.validation.optionPriceRuleRequired),
    optionId: z.string().min(1, messages.locationPriceRuleDialog.validation.optionIdRequired),
    facilityId: z.string().optional().nullable(),
    dropoffCode: z.string().max(100).optional().nullable(),
    dropoffName: z
      .string()
      .min(1, messages.locationPriceRuleDialog.validation.dropoffNameRequired)
      .max(255),
    pricingMode: z.enum(ADDON_PRICING_MODES),
    sellAmount: z.coerce.number().min(0).optional().or(z.literal("")).nullable(),
    costAmount: z.coerce.number().min(0).optional().or(z.literal("")).nullable(),
    active: z.boolean(),
    sortOrder: z.coerce.number().int(),
    notes: z.string().optional().nullable(),
  })
}

type FormSchema = ReturnType<typeof createFormSchema>
type FormValues = z.input<FormSchema>
type FormOutput = z.output<FormSchema>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule?: DropoffPriceRuleRecord
  onSuccess?: (rule: DropoffPriceRuleRecord) => void
}

const toCents = (value: number | "" | null | undefined): number | null =>
  typeof value === "number" ? Math.round(value * 100) : null

export function DropoffPriceRuleDialog({ open, onOpenChange, rule, onSuccess }: Props) {
  const isEditing = !!rule
  const { create, update } = useDropoffPriceRuleMutation()
  const messages = usePricingUiMessagesOrDefault()
  const formSchema = createFormSchema(messages)

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      optionPriceRuleId: "",
      optionId: "",
      facilityId: "",
      dropoffCode: "",
      dropoffName: "",
      pricingMode: "included",
      sellAmount: "",
      costAmount: "",
      active: true,
      sortOrder: 0,
      notes: "",
    },
  })

  useEffect(() => {
    if (open && rule) {
      form.reset({
        optionPriceRuleId: rule.optionPriceRuleId,
        optionId: rule.optionId,
        facilityId: rule.facilityId ?? "",
        dropoffCode: rule.dropoffCode ?? "",
        dropoffName: rule.dropoffName,
        pricingMode: rule.pricingMode,
        sellAmount: rule.sellAmountCents != null ? rule.sellAmountCents / 100 : "",
        costAmount: rule.costAmountCents != null ? rule.costAmountCents / 100 : "",
        active: rule.active,
        sortOrder: rule.sortOrder,
        notes: rule.notes ?? "",
      })
    } else if (open) {
      form.reset()
    }
  }, [form, open, rule])

  const onSubmit = async (values: FormOutput) => {
    const payload = {
      optionPriceRuleId: values.optionPriceRuleId,
      optionId: values.optionId,
      facilityId: values.facilityId || null,
      dropoffCode: values.dropoffCode || null,
      dropoffName: values.dropoffName,
      pricingMode: values.pricingMode,
      sellAmountCents: toCents(values.sellAmount),
      costAmountCents: toCents(values.costAmount),
      active: values.active,
      sortOrder: values.sortOrder,
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
      <SheetContent side="right" size="lg">
        <SheetHeader>
          <SheetTitle>
            {isEditing
              ? messages.locationPriceRuleDialog.dropoff.titles.edit
              : messages.locationPriceRuleDialog.dropoff.titles.create}
          </SheetTitle>
        </SheetHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <SheetBody className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label>{messages.locationPriceRuleDialog.fields.optionPriceRule}</Label>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.locationPriceRuleDialog.fields.optionId}</Label>
                <ProductOptionCombobox
                  value={form.watch("optionId")}
                  onChange={(value) =>
                    form.setValue("optionId", value ?? "", {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  requireProduct={false}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.locationPriceRuleDialog.fields.facilityId}</Label>
                <ProductFacilityCombobox
                  value={form.watch("facilityId")}
                  onChange={(value) =>
                    form.setValue("facilityId", value ?? "", {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.locationPriceRuleDialog.fields.dropoffName}</Label>
                <Input {...form.register("dropoffName")} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.locationPriceRuleDialog.fields.dropoffCode}</Label>
                <Input {...form.register("dropoffCode")} />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.locationPriceRuleDialog.fields.pricingMode}</Label>
              <Select
                items={ADDON_PRICING_MODES.map((mode) => ({
                  label: messages.common.addonPricingModeLabels[mode],
                  value: mode,
                }))}
                value={form.watch("pricingMode")}
                onValueChange={(value) =>
                  form.setValue("pricingMode", value as FormValues["pricingMode"])
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADDON_PRICING_MODES.map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {messages.common.addonPricingModeLabels[mode]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.locationPriceRuleDialog.fields.sellAmount}</Label>
                <Input {...form.register("sellAmount")} type="number" step="0.01" min="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.locationPriceRuleDialog.fields.costAmount}</Label>
                <Input {...form.register("costAmount")} type="number" step="0.01" min="0" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.locationPriceRuleDialog.fields.sortOrder}</Label>
                <Input {...form.register("sortOrder")} type="number" />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch
                  checked={form.watch("active")}
                  onCheckedChange={(checked) => form.setValue("active", checked)}
                />
                <Label>{messages.locationPriceRuleDialog.fields.active}</Label>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.locationPriceRuleDialog.fields.notes}</Label>
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
                ? messages.locationPriceRuleDialog.actions.saveRule
                : messages.locationPriceRuleDialog.actions.createRule}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
