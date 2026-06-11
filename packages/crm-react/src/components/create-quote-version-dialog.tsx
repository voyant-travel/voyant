import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
} from "@voyantjs/ui/components"
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@voyantjs/ui/components/combobox"
import { CurrencyCombobox } from "@voyantjs/ui/components/currency-combobox"
import { DatePicker } from "@voyantjs/ui/components/date-picker"
import { Loader2 } from "lucide-react"
import { useMemo, useState } from "react"
import { useCrmUiI18nOrDefault } from "../i18n/index.js"
import type { CrmQuoteStatus } from "../i18n/messages.js"
import {
  type QuoteRecord,
  type QuoteVersionRecord,
  useQuotes,
  useQuoteVersionMutation,
} from "../index.js"
import { formatCrmMoney } from "./crm-format.js"

export interface CreateQuoteVersionDialogProps {
  open: boolean
  onOpenChange: (next: boolean) => void
  defaultCurrency?: string
  onCreated?: (quoteVersion: QuoteVersionRecord) => void
}

export function CreateQuoteVersionDialog({
  open,
  onOpenChange,
  defaultCurrency = "USD",
  onCreated,
}: CreateQuoteVersionDialogProps) {
  const i18n = useCrmUiI18nOrDefault()
  const { messages } = i18n
  const { create } = useQuoteVersionMutation()

  const [quoteId, setQuoteId] = useState<string | null>(null)
  const [quoteLabel, setQuoteLabel] = useState("")
  const [quoteSearch, setQuoteSearch] = useState("")
  const [currency, setCurrency] = useState<string | null>(defaultCurrency)
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
    setCurrency(defaultCurrency)
    setValidUntil(null)
    setError(null)
  }

  async function handleCreate() {
    if (!quoteId) {
      setError(messages.createQuoteVersionDialog.validation.selectQuote)
      return
    }
    if (!currency) {
      setError(messages.createQuoteVersionDialog.validation.selectCurrency)
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
      onCreated?.(quoteVersion)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : messages.createQuoteVersionDialog.validation.createFailed,
      )
    }
  }

  function describeQuote(quote: QuoteRecord): string {
    const money = formatCrmMoney(i18n, quote.valueAmountCents, quote.valueCurrency)
    return `${quote.title} - ${money}`
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{messages.createQuoteVersionDialog.title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>{messages.createQuoteVersionDialog.fields.quote}</Label>
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
                if (!next) setQuoteId(null)
              }}
              onValueChange={(next) => {
                const id = (next as string | null) ?? null
                setQuoteId(id)
                const quote = id ? quoteResults.find((item) => item.id === id) : null
                if (quote) {
                  setQuoteLabel(describeQuote(quote))
                  if (quote.valueCurrency) setCurrency(quote.valueCurrency)
                } else {
                  setQuoteLabel("")
                }
                setQuoteSearch("")
              }}
            >
              <ComboboxInput
                placeholder={messages.createQuoteVersionDialog.placeholders.searchQuotes}
              />
              <ComboboxContent>
                <ComboboxEmpty>
                  {quotesQuery.isPending
                    ? messages.createQuoteVersionDialog.empty.loading
                    : messages.createQuoteVersionDialog.empty.noQuotes}
                </ComboboxEmpty>
                <ComboboxList>
                  <ComboboxCollection>
                    {(id) => {
                      const quote = quoteResults.find((item) => item.id === (id as string))
                      if (!quote) return null
                      const statusLabel =
                        messages.common.quoteStatusLabels[quote.status as CrmQuoteStatus] ??
                        quote.status
                      return (
                        <ComboboxItem key={quote.id} value={quote.id}>
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate font-medium">{quote.title}</span>
                            <span className="truncate text-xs text-muted-foreground">
                              {formatCrmMoney(i18n, quote.valueAmountCents, quote.valueCurrency)} -{" "}
                              {statusLabel}
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>{messages.createQuoteVersionDialog.fields.currency}</Label>
              <CurrencyCombobox
                value={currency}
                onChange={setCurrency}
                placeholder={messages.createQuoteVersionDialog.placeholders.selectCurrency}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{messages.createQuoteVersionDialog.fields.validUntil}</Label>
              <DatePicker
                value={validUntil}
                onChange={setValidUntil}
                placeholder={messages.createQuoteVersionDialog.placeholders.pickDate}
                clearable
              />
            </div>
          </div>

          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {messages.common.cancel}
          </Button>
          <Button onClick={() => void handleCreate()} disabled={create.isPending}>
            {create.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {messages.createQuoteVersionDialog.actions.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
