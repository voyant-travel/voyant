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
} from "@voyant-travel/ui/components"
import { CountryCombobox } from "@voyant-travel/ui/components/country-combobox"
import { CurrencyCombobox } from "@voyant-travel/ui/components/currency-combobox"
import { zodResolver } from "@voyant-travel/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { useMarketsUiMessagesOrDefault } from "../i18n/index.js"
import {
  type CreateMarketInput,
  type MarketRecord,
  type UpdateMarketInput,
  useMarketMutation,
} from "../index.js"
import type { MarketSetupPrefill } from "../setup-prefill.js"

const MARKET_STATUSES = ["active", "inactive", "archived"] as const

type MarketStatus = (typeof MARKET_STATUSES)[number]

function createFormSchema(messages: ReturnType<typeof useMarketsUiMessagesOrDefault>) {
  return z.object({
    code: z.string().min(1, messages.marketDialog.validation.codeRequired).max(50),
    name: z.string().min(1, messages.marketDialog.validation.nameRequired).max(255),
    status: z.enum(MARKET_STATUSES),
    regionCode: z.string().optional().nullable(),
    countryCode: z.string().optional().nullable(),
    defaultLanguageTag: z.string().min(2).max(35),
    defaultCurrency: z.string().length(3, messages.marketDialog.validation.currencyThreeChars),
    timezone: z.string().optional().nullable(),
    taxContext: z.string().optional().nullable(),
  })
}

type FormSchema = ReturnType<typeof createFormSchema>
type FormValues = z.input<FormSchema>
type FormOutput = z.output<FormSchema>

export interface MarketDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  market?: MarketRecord
  onSuccess?: (market: MarketRecord) => void
  setupPrefill?: MarketSetupPrefill
}

export function MarketDialog({
  open,
  onOpenChange,
  market,
  onSuccess,
  setupPrefill,
}: MarketDialogProps) {
  const isEditing = Boolean(market)
  const { create, update } = useMarketMutation()
  const messages = useMarketsUiMessagesOrDefault()
  const formSchema = createFormSchema(messages)

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: "",
      name: "",
      status: "active",
      regionCode: "",
      countryCode: "",
      defaultLanguageTag: "en",
      defaultCurrency: "EUR" /* i18n-literal-ok domain default currency */,
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
        code: setupPrefill?.code ?? "",
        name: setupPrefill?.name ?? "",
        status: "active",
        regionCode: setupPrefill?.regionCode ?? "",
        countryCode: setupPrefill?.countryCode ?? "",
        defaultLanguageTag: setupPrefill?.defaultLanguageTag ?? "en",
        defaultCurrency:
          setupPrefill?.defaultCurrency ?? "EUR" /* i18n-literal-ok domain default currency */,
        timezone: setupPrefill?.timezone ?? "",
        taxContext: setupPrefill?.taxContext ?? "",
      })
    }
  }, [form, market, open, setupPrefill])

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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="lg">
        <SheetHeader>
          <SheetTitle>
            {isEditing ? messages.marketDialog.titles.edit : messages.marketDialog.titles.create}
          </SheetTitle>
        </SheetHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <SheetBody className="grid gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.marketDialog.fields.code}</Label>
                <Input
                  {...form.register("code")}
                  placeholder={messages.marketDialog.placeholders.code}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.marketDialog.fields.name}</Label>
                <Input
                  {...form.register("name")}
                  placeholder={messages.marketDialog.placeholders.name}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="flex flex-col gap-2">
                <Label>{messages.marketDialog.fields.status}</Label>
                <Select
                  items={MARKET_STATUSES.map((x) => ({
                    label: messages.common.marketStatusLabels[x],
                    value: x,
                  }))}
                  value={form.watch("status")}
                  onValueChange={(value) => form.setValue("status", value as MarketStatus)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MARKET_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {messages.common.marketStatusLabels[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.marketDialog.fields.regionCode}</Label>
                <Input
                  {...form.register("regionCode")}
                  placeholder={messages.marketDialog.placeholders.regionCode}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.marketDialog.fields.country}</Label>
                <CountryCombobox
                  value={form.watch("countryCode") ?? null}
                  onChange={(code) => form.setValue("countryCode", code)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="flex flex-col gap-2">
                <Label>{messages.marketDialog.fields.languageTag}</Label>
                <Input
                  {...form.register("defaultLanguageTag")}
                  placeholder={messages.marketDialog.placeholders.languageTag}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.marketDialog.fields.defaultCurrency}</Label>
                <CurrencyCombobox
                  value={form.watch("defaultCurrency") || null}
                  onChange={(next) =>
                    form.setValue(
                      "defaultCurrency",
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
                <Label>{messages.marketDialog.fields.timezone}</Label>
                <Input
                  {...form.register("timezone")}
                  placeholder={messages.marketDialog.placeholders.timezone}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.marketDialog.fields.taxContext}</Label>
              <Input
                {...form.register("taxContext")}
                placeholder={messages.marketDialog.placeholders.taxContext}
              />
            </div>
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? messages.common.saveChanges : messages.marketDialog.actions.create}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
