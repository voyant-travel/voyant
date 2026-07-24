"use client"

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
} from "@voyant-travel/ui/components"
import { CurrencyCombobox } from "@voyant-travel/ui/components/currency-combobox"
import { zodResolver } from "@voyant-travel/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { useMarketsUiMessagesOrDefault } from "../i18n/index.js"
import {
  type CreateMarketCurrencyInput,
  type MarketCurrencyRecord,
  type UpdateMarketCurrencyInput,
  useMarketCurrencyMutation,
} from "../index.js"

function createFormSchema(messages: ReturnType<typeof useMarketsUiMessagesOrDefault>) {
  return z.object({
    currencyCode: z.string().length(3, messages.marketCurrencyDialog.validation.currencyThreeChars),
    isDefault: z.boolean(),
    isSettlement: z.boolean(),
    isReporting: z.boolean(),
    sortOrder: z.coerce.number().int().min(0),
    active: z.boolean(),
  })
}

type FormSchema = ReturnType<typeof createFormSchema>
type FormValues = z.input<FormSchema>
type FormOutput = z.output<FormSchema>

export interface MarketCurrencyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  marketId: string
  currency?: MarketCurrencyRecord
  onSuccess?: (currency: MarketCurrencyRecord) => void
}

export function MarketCurrencyDialog({
  open,
  onOpenChange,
  marketId,
  currency,
  onSuccess,
}: MarketCurrencyDialogProps) {
  const isEditing = Boolean(currency)
  const { create, update } = useMarketCurrencyMutation()
  const messages = useMarketsUiMessagesOrDefault()
  const formSchema = createFormSchema(messages)

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      currencyCode: "EUR" /* i18n-literal-ok domain default currency */,
      isDefault: false,
      isSettlement: false,
      isReporting: false,
      sortOrder: 0,
      active: true,
    },
  })

  useEffect(() => {
    if (open && currency) {
      form.reset({
        currencyCode: currency.currencyCode,
        isDefault: currency.isDefault,
        isSettlement: currency.isSettlement,
        isReporting: currency.isReporting,
        sortOrder: currency.sortOrder,
        active: currency.active,
      })
      return
    }
    if (open) {
      form.reset({
        currencyCode: "EUR" /* i18n-literal-ok domain default currency */,
        isDefault: false,
        isSettlement: false,
        isReporting: false,
        sortOrder: 0,
        active: true,
      })
    }
  }, [currency, form, open])

  const onSubmit = async (values: FormOutput) => {
    const payload: CreateMarketCurrencyInput | UpdateMarketCurrencyInput = {
      currencyCode: values.currencyCode.toUpperCase(),
      isDefault: values.isDefault,
      isSettlement: values.isSettlement,
      isReporting: values.isReporting,
      sortOrder: values.sortOrder,
      active: values.active,
    }

    const saved = isEditing
      ? await update.mutateAsync({ id: currency!.id, input: payload })
      : await create.mutateAsync({ marketId, input: payload as CreateMarketCurrencyInput })

    onOpenChange(false)
    onSuccess?.(saved)
  }

  const isSubmitting = form.formState.isSubmitting || create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? messages.marketCurrencyDialog.titles.edit
              : messages.marketCurrencyDialog.titles.create}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.marketCurrencyDialog.fields.currencyCode}</Label>
                <CurrencyCombobox
                  value={form.watch("currencyCode") || null}
                  onChange={(next) =>
                    form.setValue(
                      "currencyCode",
                      next ?? "EUR" /* i18n-literal-ok domain default currency */,
                      {
                        shouldValidate: true,
                        shouldDirty: true,
                      },
                    )
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.marketCurrencyDialog.fields.sortOrder}</Label>
                <Input {...form.register("sortOrder")} type="number" min="0" />
              </div>
            </div>

            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("isDefault")}
                  onCheckedChange={(value) => form.setValue("isDefault", value)}
                />
                <Label>{messages.marketCurrencyDialog.fields.isDefault}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("isSettlement")}
                  onCheckedChange={(value) => form.setValue("isSettlement", value)}
                />
                <Label>{messages.marketCurrencyDialog.fields.isSettlement}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("isReporting")}
                  onCheckedChange={(value) => form.setValue("isReporting", value)}
                />
                <Label>{messages.marketCurrencyDialog.fields.isReporting}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("active")}
                  onCheckedChange={(value) => form.setValue("active", value)}
                />
                <Label>{messages.marketCurrencyDialog.fields.active}</Label>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing
                ? messages.common.saveChanges
                : messages.marketCurrencyDialog.actions.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
