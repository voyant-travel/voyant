import type { QuoteVersionLineRecord } from "@voyantjs/crm-react"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"

import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/components/ui"
import { CurrencyInput } from "@/components/ui/currency-input"

import { useRegistryCrmI18nOrDefault, useRegistryCrmMessagesOrDefault } from "./i18n"
import { formatRegistryCrmMoney } from "./i18n/utils"

export interface QuoteVersionLinesCardProps {
  currency: string
  lines: QuoteVersionLineRecord[]
  isLoading: boolean
  onCreate: (input: {
    description: string
    currency: string
    quantity: number
    unitPriceAmountCents: number
    totalAmountCents: number
  }) => Promise<void> // i18n-literal-ok local callback type alias
  onUpdate: (
    lineId: string,
    input: Partial<{
      description: string
      quantity: number
      unitPriceAmountCents: number
      totalAmountCents: number
    }>,
  ) => Promise<void> // i18n-literal-ok local callback type alias
  onRemove: (lineId: string) => Promise<void> // i18n-literal-ok local callback type alias
}

export function QuoteVersionLinesCard({
  currency,
  lines,
  isLoading,
  onCreate,
  onUpdate,
  onRemove,
}: QuoteVersionLinesCardProps) {
  const i18n = useRegistryCrmI18nOrDefault()
  const m = useRegistryCrmMessagesOrDefault()
  const [newDescription, setNewDescription] = useState("")
  const [newQuantity, setNewQuantity] = useState("1")
  const [newPriceCents, setNewPriceCents] = useState<number | null>(0)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAdd() {
    const desc = newDescription.trim()
    if (!desc) {
      setError(m.quoteVersionLinesCard.validation.descriptionRequired)
      return
    }
    const qty = Number.parseInt(newQuantity, 10) || 1
    const price = newPriceCents ?? 0
    setAdding(true)
    setError(null)
    try {
      await onCreate({
        description: desc,
        currency,
        quantity: qty,
        unitPriceAmountCents: price,
        totalAmountCents: qty * price,
      })
      setNewDescription("")
      setNewQuantity("1")
      setNewPriceCents(0)
    } catch (err) {
      setError(err instanceof Error ? err.message : m.quoteVersionLinesCard.validation.addFailed)
    } finally {
      setAdding(false)
    }
  }

  const subtotal = lines.reduce((sum, line) => sum + line.totalAmountCents, 0)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">{m.quoteVersionLinesCard.title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : lines.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {m.quoteVersionLinesCard.empty}
          </p>
        ) : (
          <ul className="divide-y">
            {lines.map((line) => (
              <QuoteVersionLineRow
                key={line.id}
                currency={currency}
                line={line}
                onUpdate={(input) => onUpdate(line.id, input)}
                onRemove={() => onRemove(line.id)}
              />
            ))}
          </ul>
        )}

        <div className="mt-3 flex flex-col gap-2 border-t pt-3">
          <div className="grid grid-cols-12 gap-2">
            <Input
              className="col-span-6 h-8 text-sm"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder={m.quoteVersionLinesCard.fields.description}
            />
            <Input
              className="col-span-2 h-8 text-sm"
              type="number"
              min={1}
              value={newQuantity}
              onChange={(e) => setNewQuantity(e.target.value)}
              placeholder={m.quoteVersionLinesCard.fields.quantity}
            />
            <CurrencyInput
              className="col-span-3 h-8 text-sm"
              inputClassName="h-8 text-sm"
              value={newPriceCents}
              onChange={setNewPriceCents}
              currency={currency}
              placeholder={m.quoteVersionLinesCard.fields.priceCents}
            />
            <Button
              size="sm"
              className="col-span-1 h-8"
              onClick={() => void handleAdd()}
              disabled={adding}
            >
              {adding ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Plus className="size-3.5" />
              )}
            </Button>
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>

        <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm">
          <span className="text-muted-foreground">{m.quoteVersionLinesCard.subtotal}</span>
          <span className="font-semibold">{formatRegistryCrmMoney(i18n, subtotal, currency)}</span>
        </div>
      </CardContent>
    </Card>
  )
}

function QuoteVersionLineRow({
  currency,
  line,
  onUpdate,
  onRemove,
}: {
  currency: string
  line: QuoteVersionLineRecord
  onUpdate: (input: {
    description?: string
    quantity?: number
    unitPriceAmountCents?: number
    totalAmountCents?: number
  }) => Promise<void> // i18n-literal-ok local callback type alias
  onRemove: () => Promise<void> // i18n-literal-ok local callback type alias
}) {
  const i18n = useRegistryCrmI18nOrDefault()
  const [removing, setRemoving] = useState(false)
  const [draftPriceCents, setDraftPriceCents] = useState<number | null>(line.unitPriceAmountCents)

  useEffect(() => {
    setDraftPriceCents(line.unitPriceAmountCents)
  }, [line.unitPriceAmountCents])

  async function handleRemove() {
    setRemoving(true)
    try {
      await onRemove()
    } finally {
      setRemoving(false)
    }
  }

  async function handleQuantity(value: string) {
    const qty = Number.parseInt(value, 10)
    if (!Number.isFinite(qty) || qty < 1) {
      return
    }
    await onUpdate({
      quantity: qty,
      totalAmountCents: qty * line.unitPriceAmountCents,
    })
  }

  async function handlePrice(value: number | null) {
    if (value == null || value < 0 || value === line.unitPriceAmountCents) {
      return
    }
    await onUpdate({
      unitPriceAmountCents: value,
      totalAmountCents: line.quantity * value,
    })
  }

  return (
    <li className="py-2">
      <div className="grid grid-cols-12 items-center gap-2">
        <Input
          className="col-span-6 h-8 text-sm"
          defaultValue={line.description}
          onBlur={(e) => {
            const value = e.target.value.trim()
            if (value && value !== line.description) {
              void onUpdate({ description: value })
            }
          }}
        />
        <Input
          className="col-span-2 h-8 text-sm"
          type="number"
          min={1}
          defaultValue={line.quantity}
          onBlur={(e) => void handleQuantity(e.target.value)}
        />
        <CurrencyInput
          className="col-span-2 h-8 text-sm"
          inputClassName="h-8 text-sm"
          value={draftPriceCents}
          onChange={setDraftPriceCents}
          onBlur={() => void handlePrice(draftPriceCents)}
          currency={currency}
        />
        <span className="col-span-1 text-right text-sm font-medium">
          {formatRegistryCrmMoney(i18n, line.totalAmountCents, currency)}
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="col-span-1 h-8 w-8 p-0"
          onClick={() => void handleRemove()}
          disabled={removing}
        >
          {removing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Trash2 className="size-3.5" />
          )}
        </Button>
      </div>
    </li>
  )
}
