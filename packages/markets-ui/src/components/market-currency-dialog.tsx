"use client"

import {
  type CreateMarketCurrencyInput,
  type MarketCurrencyRecord,
  type UpdateMarketCurrencyInput,
  useMarketCurrencyMutation,
} from "@voyantjs/markets-react"
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
} from "@voyantjs/voyant-ui/components"
import { CurrencyCombobox } from "@voyantjs/voyant-ui/components/currency-combobox"
import { zodResolver } from "@voyantjs/voyant-ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"

const formSchema = z.object({
  currencyCode: z.string().length(3, "Currency must be 3 chars"),
  isDefault: z.boolean(),
  isSettlement: z.boolean(),
  isReporting: z.boolean(),
  sortOrder: z.coerce.number().int().min(0),
  active: z.boolean(),
})

type FormValues = z.input<typeof formSchema>
type FormOutput = z.output<typeof formSchema>

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

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      currencyCode: "EUR",
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
        currencyCode: "EUR",
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
          <DialogTitle>{isEditing ? "Edit Currency" : "Add Currency"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Currency code</Label>
                <CurrencyCombobox
                  value={form.watch("currencyCode") || null}
                  onChange={(next) =>
                    form.setValue("currencyCode", next ?? "EUR", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Sort order</Label>
                <Input {...form.register("sortOrder")} type="number" min="0" />
              </div>
            </div>

            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("isDefault")}
                  onCheckedChange={(value) => form.setValue("isDefault", value)}
                />
                <Label>Default</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("isSettlement")}
                  onCheckedChange={(value) => form.setValue("isSettlement", value)}
                />
                <Label>Settlement</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("isReporting")}
                  onCheckedChange={(value) => form.setValue("isReporting", value)}
                />
                <Label>Reporting</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("active")}
                  onCheckedChange={(value) => form.setValue("active", value)}
                />
                <Label>Active</Label>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Add Currency"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
