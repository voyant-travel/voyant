import {
  type OpportunityRecord,
  type QuoteRecord,
  useOpportunities,
  useQuoteMutation,
} from "@voyantjs/crm-react"
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
import type { CrmOpportunityStatus } from "../i18n/messages.js"
import { formatCrmMoney } from "./crm-format.js"

export interface CreateQuoteDialogProps {
  open: boolean
  onOpenChange: (next: boolean) => void
  defaultCurrency?: string
  onCreated?: (quote: QuoteRecord) => void
}

export function CreateQuoteDialog({
  open,
  onOpenChange,
  defaultCurrency = "USD",
  onCreated,
}: CreateQuoteDialogProps) {
  const i18n = useCrmUiI18nOrDefault()
  const { messages } = i18n
  const { create } = useQuoteMutation()

  const [opportunityId, setOpportunityId] = useState<string | null>(null)
  const [opportunityLabel, setOpportunityLabel] = useState("")
  const [opportunitySearch, setOpportunitySearch] = useState("")
  const [currency, setCurrency] = useState<string | null>(defaultCurrency)
  const [validUntil, setValidUntil] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const opportunitiesQuery = useOpportunities({
    search: opportunitySearch || undefined,
    limit: 20,
    enabled: open,
  })
  const opportunityResults = useMemo(
    () => opportunitiesQuery.data?.data ?? [],
    [opportunitiesQuery.data],
  )
  const opportunityIds = useMemo(
    () => opportunityResults.map((opportunity) => opportunity.id),
    [opportunityResults],
  )

  function reset() {
    setOpportunityId(null)
    setOpportunityLabel("")
    setOpportunitySearch("")
    setCurrency(defaultCurrency)
    setValidUntil(null)
    setError(null)
  }

  async function handleCreate() {
    if (!opportunityId) {
      setError(messages.createQuoteDialog.validation.selectOpportunity)
      return
    }
    if (!currency) {
      setError(messages.createQuoteDialog.validation.selectCurrency)
      return
    }
    setError(null)
    try {
      const quote = await create.mutateAsync({
        opportunityId,
        currency,
        validUntil: validUntil ?? null,
      })
      reset()
      onOpenChange(false)
      onCreated?.(quote)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : messages.createQuoteDialog.validation.createFailed,
      )
    }
  }

  function describeOpportunity(opportunity: OpportunityRecord): string {
    const money = formatCrmMoney(i18n, opportunity.valueAmountCents, opportunity.valueCurrency)
    return `${opportunity.title} - ${money}`
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
          <DialogTitle>{messages.createQuoteDialog.title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>{messages.createQuoteDialog.fields.opportunity}</Label>
            <Combobox
              items={opportunityIds}
              value={opportunityId}
              inputValue={opportunityLabel}
              autoHighlight
              filter={() => true}
              itemToStringValue={(id) => {
                const opportunity = opportunityResults.find((item) => item.id === (id as string))
                return opportunity ? describeOpportunity(opportunity) : ""
              }}
              onInputValueChange={(next) => {
                const match = opportunityResults.find((opportunity) => opportunity.id === next)
                if (match) {
                  setOpportunityLabel(describeOpportunity(match))
                  return
                }
                setOpportunityLabel(next)
                setOpportunitySearch(next)
                if (!next) setOpportunityId(null)
              }}
              onValueChange={(next) => {
                const id = (next as string | null) ?? null
                setOpportunityId(id)
                const opportunity = id ? opportunityResults.find((item) => item.id === id) : null
                if (opportunity) {
                  setOpportunityLabel(describeOpportunity(opportunity))
                  if (opportunity.valueCurrency) setCurrency(opportunity.valueCurrency)
                } else {
                  setOpportunityLabel("")
                }
                setOpportunitySearch("")
              }}
            >
              <ComboboxInput
                placeholder={messages.createQuoteDialog.placeholders.searchOpportunities}
              />
              <ComboboxContent>
                <ComboboxEmpty>
                  {opportunitiesQuery.isPending
                    ? messages.createQuoteDialog.empty.loading
                    : messages.createQuoteDialog.empty.noOpportunities}
                </ComboboxEmpty>
                <ComboboxList>
                  <ComboboxCollection>
                    {(id) => {
                      const opportunity = opportunityResults.find(
                        (item) => item.id === (id as string),
                      )
                      if (!opportunity) return null
                      const statusLabel =
                        messages.common.opportunityStatusLabels[
                          opportunity.status as CrmOpportunityStatus
                        ] ?? opportunity.status
                      return (
                        <ComboboxItem key={opportunity.id} value={opportunity.id}>
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate font-medium">{opportunity.title}</span>
                            <span className="truncate text-xs text-muted-foreground">
                              {formatCrmMoney(
                                i18n,
                                opportunity.valueAmountCents,
                                opportunity.valueCurrency,
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>{messages.createQuoteDialog.fields.currency}</Label>
              <CurrencyCombobox
                value={currency}
                onChange={setCurrency}
                placeholder={messages.createQuoteDialog.placeholders.selectCurrency}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{messages.createQuoteDialog.fields.validUntil}</Label>
              <DatePicker
                value={validUntil}
                onChange={setValidUntil}
                placeholder={messages.createQuoteDialog.placeholders.pickDate}
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
            {messages.createQuoteDialog.actions.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
