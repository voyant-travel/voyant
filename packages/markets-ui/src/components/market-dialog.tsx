"use client"

import {
  type CreateMarketInput,
  type MarketRecord,
  type UpdateMarketInput,
  useMarketMutation,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components"
import { CountryCombobox } from "@voyantjs/ui/components/country-combobox"
import { CurrencyCombobox } from "@voyantjs/ui/components/currency-combobox"
import { zodResolver } from "@voyantjs/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"

const MARKET_STATUSES = ["active", "inactive", "archived"] as const

type MarketStatus = (typeof MARKET_STATUSES)[number]

const formSchema = z.object({
  code: z.string().min(1, "Code is required").max(50),
  name: z.string().min(1, "Name is required").max(255),
  status: z.enum(MARKET_STATUSES),
  regionCode: z.string().optional().nullable(),
  countryCode: z.string().optional().nullable(),
  defaultLanguageTag: z.string().min(2).max(35),
  defaultCurrency: z.string().length(3, "Currency must be 3 chars"),
  timezone: z.string().optional().nullable(),
  taxContext: z.string().optional().nullable(),
})

type FormValues = z.input<typeof formSchema>
type FormOutput = z.output<typeof formSchema>

export interface MarketDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  market?: MarketRecord
  onSuccess?: (market: MarketRecord) => void
}

export function MarketDialog({ open, onOpenChange, market, onSuccess }: MarketDialogProps) {
  const isEditing = Boolean(market)
  const { create, update } = useMarketMutation()

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: "",
      name: "",
      status: "active",
      regionCode: "",
      countryCode: "",
      defaultLanguageTag: "en",
      defaultCurrency: "EUR",
      timezone: "",
      taxContext: "",
    },
  })

  useEffect(() => {
    if (open && market) {
      form.reset({
        code: market.code,
        name: market.name,
        status: market.status as MarketStatus,
        regionCode: market.regionCode ?? "",
        countryCode: market.countryCode ?? "",
        defaultLanguageTag: market.defaultLanguageTag,
        defaultCurrency: market.defaultCurrency,
        timezone: market.timezone ?? "",
        taxContext: market.taxContext ?? "",
      })
      return
    }
    if (open) {
      form.reset({
        code: "",
        name: "",
        status: "active",
        regionCode: "",
        countryCode: "",
        defaultLanguageTag: "en",
        defaultCurrency: "EUR",
        timezone: "",
        taxContext: "",
      })
    }
  }, [form, market, open])

  const onSubmit = async (values: FormOutput) => {
    const payload: CreateMarketInput | UpdateMarketInput = {
      code: values.code,
      name: values.name,
      status: values.status,
      regionCode: values.regionCode || null,
      countryCode: values.countryCode ? values.countryCode.toUpperCase() : null,
      defaultLanguageTag: values.defaultLanguageTag,
      defaultCurrency: values.defaultCurrency.toUpperCase(),
      timezone: values.timezone || null,
      taxContext: values.taxContext || null,
    }

    const saved = isEditing
      ? await update.mutateAsync({ id: market!.id, input: payload })
      : await create.mutateAsync(payload as CreateMarketInput)

    onOpenChange(false)
    onSuccess?.(saved)
  }

  const isSubmitting = form.formState.isSubmitting || create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Market" : "Add Market"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Code</Label>
                <Input {...form.register("code")} placeholder="EU-DE" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Name</Label>
                <Input {...form.register("name")} placeholder="Germany" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-2">
                <Label>Status</Label>
                <Select
                  items={MARKET_STATUSES.map((x) => ({ label: x.replace(/_/g, " "), value: x }))}
                  value={form.watch("status")}
                  onValueChange={(value) => form.setValue("status", value as MarketStatus)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MARKET_STATUSES.map((status) => (
                      <SelectItem key={status} value={status} className="capitalize">
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Region code</Label>
                <Input {...form.register("regionCode")} placeholder="EU, APAC..." />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Country</Label>
                <CountryCombobox
                  value={form.watch("countryCode") ?? null}
                  onChange={(code) => form.setValue("countryCode", code)}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-2">
                <Label>Language tag</Label>
                <Input {...form.register("defaultLanguageTag")} placeholder="en, de-DE..." />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Default currency</Label>
                <CurrencyCombobox
                  value={form.watch("defaultCurrency") || null}
                  onChange={(next) =>
                    form.setValue("defaultCurrency", next ?? "EUR", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Timezone</Label>
                <Input {...form.register("timezone")} placeholder="Europe/Berlin" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Tax context</Label>
              <Input {...form.register("taxContext")} placeholder="EU-VAT, US-Sales-Tax..." />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Add Market"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
