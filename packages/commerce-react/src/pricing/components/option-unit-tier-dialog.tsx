"use client"

import {
  Button,
  Input,
  Label,
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Switch,
} from "@voyant-travel/ui/components"
import { zodResolver } from "@voyant-travel/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { usePricingUiMessagesOrDefault } from "../i18n/provider.js"
import { type OptionUnitTierRecord, useOptionUnitTierMutation } from "../index.js"
import { OptionUnitPriceRuleCombobox } from "./option-unit-price-rule-combobox.js"

function createFormSchema(messages: ReturnType<typeof usePricingUiMessagesOrDefault>) {
  return z.object({
    optionUnitPriceRuleId: z
      .string()
      .min(1, messages.optionUnitTierDialog.validation.optionUnitPriceRuleRequired),
    minQuantity: z.coerce
      .number()
      .int()
      .min(1, messages.optionUnitTierDialog.validation.minQuantityMin),
    maxQuantity: z.coerce.number().int().min(1).optional().or(z.literal("")).nullable(),
    sellAmount: z.coerce.number().min(0).optional().or(z.literal("")).nullable(),
    costAmount: z.coerce.number().min(0).optional().or(z.literal("")).nullable(),
    active: z.boolean(),
    sortOrder: z.coerce.number().int(),
  })
}

type FormSchema = ReturnType<typeof createFormSchema>
type FormValues = z.input<FormSchema>
type FormOutput = z.output<FormSchema>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  tier?: OptionUnitTierRecord
  onSuccess?: (tier: OptionUnitTierRecord) => void
}

const toCents = (value: number | "" | null | undefined): number | null =>
  typeof value === "number" ? Math.round(value * 100) : null
const toInt = (value: number | "" | null | undefined): number | null =>
  typeof value === "number" ? value : null

export function OptionUnitTierDialog({ open, onOpenChange, tier, onSuccess }: Props) {
  const isEditing = !!tier
  const { create, update } = useOptionUnitTierMutation()
  const messages = usePricingUiMessagesOrDefault()
  const formSchema = createFormSchema(messages)

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      optionUnitPriceRuleId: "",
      minQuantity: 1,
      maxQuantity: "",
      sellAmount: "",
      costAmount: "",
      active: true,
      sortOrder: 0,
    },
  })

  useEffect(() => {
    if (open && tier) {
      form.reset({
        optionUnitPriceRuleId: tier.optionUnitPriceRuleId,
        minQuantity: tier.minQuantity,
        maxQuantity: tier.maxQuantity ?? "",
        sellAmount: tier.sellAmountCents != null ? tier.sellAmountCents / 100 : "",
        costAmount: tier.costAmountCents != null ? tier.costAmountCents / 100 : "",
        active: tier.active,
        sortOrder: tier.sortOrder,
      })
    } else if (open) {
      form.reset({
        optionUnitPriceRuleId: "",
        minQuantity: 1,
        maxQuantity: "",
        sellAmount: "",
        costAmount: "",
        active: true,
        sortOrder: 0,
      })
    }
  }, [open, tier, form])

  const onSubmit = async (values: FormOutput) => {
    const payload = {
      optionUnitPriceRuleId: values.optionUnitPriceRuleId,
      minQuantity: values.minQuantity,
      maxQuantity: toInt(values.maxQuantity),
      sellAmountCents: toCents(values.sellAmount),
      costAmountCents: toCents(values.costAmount),
      active: values.active,
      sortOrder: values.sortOrder,
    }

    const saved = isEditing
      ? await update.mutateAsync({ id: tier.id, input: payload })
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
              ? messages.optionUnitTierDialog.titles.edit
              : messages.optionUnitTierDialog.titles.create}
          </SheetTitle>
        </SheetHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <SheetBody className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label>{messages.optionUnitTierDialog.fields.optionUnitPriceRule}</Label>
              <OptionUnitPriceRuleCombobox
                value={form.watch("optionUnitPriceRuleId")}
                onChange={(value) =>
                  form.setValue("optionUnitPriceRuleId", value ?? "", {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                placeholder={messages.optionUnitTierDialog.placeholders.optionUnitPriceRule}
                disabled={isEditing}
              />
              {form.formState.errors.optionUnitPriceRuleId ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.optionUnitPriceRuleId.message}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.optionUnitTierDialog.fields.minQuantity}</Label>
                <Input {...form.register("minQuantity")} type="number" min="1" />
                {form.formState.errors.minQuantity ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.minQuantity.message}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.optionUnitTierDialog.fields.maxQuantity}</Label>
                <Input {...form.register("maxQuantity")} type="number" min="1" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.optionUnitTierDialog.fields.sellAmount}</Label>
                <Input {...form.register("sellAmount")} type="number" step="0.01" min="0" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.optionUnitTierDialog.fields.costAmount}</Label>
                <Input {...form.register("costAmount")} type="number" step="0.01" min="0" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.optionUnitTierDialog.fields.sortOrder}</Label>
                <Input {...form.register("sortOrder")} type="number" />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch
                  checked={form.watch("active")}
                  onCheckedChange={(checked) => form.setValue("active", checked)}
                />
                <Label>{messages.optionUnitTierDialog.fields.active}</Label>
              </div>
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
                : messages.optionUnitTierDialog.actions.create}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
