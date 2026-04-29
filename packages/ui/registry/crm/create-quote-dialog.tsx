import { useNavigate } from "@tanstack/react-router"
import { type OpportunityRecord, useOpportunities, useQuoteMutation } from "@voyantjs/crm-react"
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

export function CreateQuoteDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
}) {
  const navigate = useNavigate()
  const i18n = useRegistryCrmI18nOrDefault()
  const m = useRegistryCrmMessagesOrDefault()
  const { create } = useQuoteMutation()

  const [opportunityId, setOpportunityId] = useState<string | null>(null)
  const [opportunityLabel, setOpportunityLabel] = useState("")
  const [opportunitySearch, setOpportunitySearch] = useState("")
  const [currency, setCurrency] = useState("USD")
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
    setCurrency("USD")
    setValidUntil(null)
    setError(null)
  }

  async function handleCreate() {
    if (!opportunityId) {
      setError(m.createQuoteDialog.validation.selectOpportunity)
      return
    }
    if (!currency) {
      setError(m.createQuoteDialog.validation.selectCurrency)
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
      void navigate({ to: "/quotes/$id", params: { id: quote.id } })
    } catch (err) {
      setError(err instanceof Error ? err.message : m.createQuoteDialog.validation.createFailed)
    }
  }

  function describeOpportunity(opportunity: OpportunityRecord): string {
    const money = formatRegistryCrmMoney(
      i18n,
      opportunity.valueAmountCents,
      opportunity.valueCurrency,
    )
    return `${opportunity.title} - ${money}`
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
          <DialogTitle>{m.createQuoteDialog.title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>{m.createQuoteDialog.fields.opportunity}</Label>
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
                if (!next) {
                  setOpportunityId(null)
                }
              }}
              onValueChange={(next) => {
                const id = (next as string | null) ?? null
                setOpportunityId(id)
                const opportunity = id ? opportunityResults.find((item) => item.id === id) : null
                if (opportunity) {
                  setOpportunityLabel(describeOpportunity(opportunity))
                  if (opportunity.valueCurrency) {
                    setCurrency(opportunity.valueCurrency)
                  }
                } else {
                  setOpportunityLabel("")
                }
                setOpportunitySearch("")
              }}
            >
              <ComboboxInput placeholder={m.createQuoteDialog.placeholders.searchOpportunities} />
              <ComboboxContent>
                <ComboboxEmpty>
                  {opportunitiesQuery.isPending
                    ? m.createQuoteDialog.empty.loading
                    : m.createQuoteDialog.empty.noOpportunities}
                </ComboboxEmpty>
                <ComboboxList>
                  <ComboboxCollection>
                    {(id) => {
                      const opportunity = opportunityResults.find(
                        (item) => item.id === (id as string),
                      )
                      if (!opportunity) {
                        return null
                      }
                      const statusLabel =
                        m.common.opportunityStatusLabels[
                          opportunity.status as keyof typeof m.common.opportunityStatusLabels
                        ] ?? opportunity.status
                      return (
                        <ComboboxItem key={opportunity.id} value={opportunity.id}>
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate font-medium">{opportunity.title}</span>
                            <span className="truncate text-xs text-muted-foreground">
                              {formatRegistryCrmMoney(
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

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{m.createQuoteDialog.fields.currency}</Label>
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
                  <ComboboxEmpty>{m.createQuoteDialog.empty.noCurrencies}</ComboboxEmpty>
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
              <Label>{m.createQuoteDialog.fields.validUntil}</Label>
              <DatePicker
                value={validUntil}
                onChange={setValidUntil}
                placeholder={m.createQuoteDialog.placeholders.pickDate}
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
            {m.createQuoteDialog.actions.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
