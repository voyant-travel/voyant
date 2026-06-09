import { useNavigate } from "@tanstack/react-router"
import { type QuoteRecord, useQuotes, useQuoteVersionMutation } from "@voyantjs/crm-react"
import { currencies } from "@voyantjs/utils/currencies"
import { Loader2 } from "lucide-react"
import { useMemo, useState } from "react"

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
} from "@/components/ui"
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { DatePicker } from "@/components/ui/date-picker"

import { useRegistryCrmI18nOrDefault, useRegistryCrmMessagesOrDefault } from "./i18n"
import { formatRegistryCrmMoney } from "./i18n/utils"

const CURRENCY_CODES = Object.keys(currencies).sort()

export function CreateQuoteVersionDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
}) {
  const navigate = useNavigate()
  const i18n = useRegistryCrmI18nOrDefault()
  const m = useRegistryCrmMessagesOrDefault()
  const { create } = useQuoteVersionMutation()

  const [quoteId, setQuoteId] = useState<string | null>(null)
  const [quoteLabel, setQuoteLabel] = useState("")
  const [quoteSearch, setQuoteSearch] = useState("")
  const [currency, setCurrency] = useState("USD")
  const [validUntil, setValidUntil] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const quotesQuery = useQuotes({
    search: quoteSearch || undefined,
    limit: 20,
    enabled: open,
  })
  const quoteResults = useMemo(() => quotesQuery.data?.data ?? [], [quotesQuery.data])
  const quoteIds = useMemo(() => quoteResults.map((quote) => quote.id), [quoteResults])

  function reset() {
    setQuoteId(null)
    setQuoteLabel("")
    setQuoteSearch("")
    setCurrency("USD")
    setValidUntil(null)
    setError(null)
  }

  async function handleCreate() {
    if (!quoteId) {
      setError(m.createQuoteVersionDialog.validation.selectQuote)
      return
    }
    if (!currency) {
      setError(m.createQuoteVersionDialog.validation.selectCurrency)
      return
    }
    setError(null)
    try {
      const quoteVersion = await create.mutateAsync({
        quoteId,
        input: {
          currency,
          validUntil: validUntil ?? null,
        },
      })
      reset()
      onOpenChange(false)
      void navigate({ to: "/quote-versions/$id", params: { id: quoteVersion.id } })
    } catch (err) {
      setError(
        err instanceof Error ? err.message : m.createQuoteVersionDialog.validation.createFailed,
      )
    }
  }

  function describeQuote(quote: QuoteRecord): string {
    const money = formatRegistryCrmMoney(i18n, quote.valueAmountCents, quote.valueCurrency)
    return `${quote.title} - ${money}`
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset()
        }
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m.createQuoteVersionDialog.title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>{m.createQuoteVersionDialog.fields.quote}</Label>
            <Combobox
              items={quoteIds}
              value={quoteId}
              inputValue={quoteLabel}
              autoHighlight
              filter={() => true}
              itemToStringValue={(id) => {
                const quote = quoteResults.find((item) => item.id === (id as string))
                return quote ? describeQuote(quote) : ""
              }}
              onInputValueChange={(next) => {
                const match = quoteResults.find((quote) => quote.id === next)
                if (match) {
                  setQuoteLabel(describeQuote(match))
                  return
                }
                setQuoteLabel(next)
                setQuoteSearch(next)
                if (!next) {
                  setQuoteId(null)
                }
              }}
              onValueChange={(next) => {
                const id = (next as string | null) ?? null
                setQuoteId(id)
                const quote = id ? quoteResults.find((item) => item.id === id) : null
                if (quote) {
                  setQuoteLabel(describeQuote(quote))
                  if (quote.valueCurrency) {
                    setCurrency(quote.valueCurrency)
                  }
                } else {
                  setQuoteLabel("")
                }
                setQuoteSearch("")
              }}
            >
              <ComboboxInput placeholder={m.createQuoteVersionDialog.placeholders.searchQuotes} />
              <ComboboxContent>
                <ComboboxEmpty>
                  {quotesQuery.isPending
                    ? m.createQuoteVersionDialog.empty.loading
                    : m.createQuoteVersionDialog.empty.noQuotes}
                </ComboboxEmpty>
                <ComboboxList>
                  <ComboboxCollection>
                    {(id) => {
                      const quote = quoteResults.find((item) => item.id === (id as string))
                      if (!quote) {
                        return null
                      }
                      const statusLabel =
                        m.common.quoteStatusLabels[
                          quote.status as keyof typeof m.common.quoteStatusLabels
                        ] ?? quote.status
                      return (
                        <ComboboxItem key={quote.id} value={quote.id}>
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate font-medium">{quote.title}</span>
                            <span className="truncate text-xs text-muted-foreground">
                              {formatRegistryCrmMoney(
                                i18n,
                                quote.valueAmountCents,
                                quote.valueCurrency,
                              )}{" "}
                              - {statusLabel}
                            </span>
                          </div>
                        </ComboboxItem>
                      )
                    }}
                  </ComboboxCollection>
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{m.createQuoteVersionDialog.fields.currency}</Label>
              <Combobox
                items={CURRENCY_CODES}
                value={currency}
                autoHighlight
                itemToStringValue={(code) => {
                  const info = currencies[code as keyof typeof currencies]
                  return info ? `${code} - ${info.name}` : (code as string)
                }}
                onValueChange={(next) => {
                  if (typeof next === "string") {
                    setCurrency(next)
                  }
                }}
              >
                <ComboboxInput />
                <ComboboxContent>
                  <ComboboxEmpty>{m.createQuoteVersionDialog.empty.noCurrencies}</ComboboxEmpty>
                  <ComboboxList>
                    <ComboboxCollection>
                      {(code) => {
                        const info = currencies[code as keyof typeof currencies]
                        return (
                          <ComboboxItem key={code as string} value={code as string}>
                            <span className="font-mono text-xs">{code as string}</span>
                            {info ? (
                              <span className="ml-2 text-xs text-muted-foreground">
                                {info.name}
                              </span>
                            ) : null}
                          </ComboboxItem>
                        )
                      }}
                    </ComboboxCollection>
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{m.createQuoteVersionDialog.fields.validUntil}</Label>
              <DatePicker
                value={validUntil}
                onChange={setValidUntil}
                placeholder={m.createQuoteVersionDialog.placeholders.pickDate}
                clearable
              />
            </div>
          </div>

          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {m.common.cancel}
          </Button>
          <Button onClick={() => void handleCreate()} disabled={create.isPending}>
            {create.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {m.createQuoteVersionDialog.actions.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
