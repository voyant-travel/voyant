import type { QuoteVersionLineRecord } from "@voyantjs/crm-react"
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@voyantjs/ui/components"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { formatMoney } from "@/components/voyant/crm/crm-constants"

export interface QuoteVersionLinesCardProps {
  currency: string
  lines: QuoteVersionLineRecord[]
  isLoading: boolean
  editable?: boolean
  onCreate: (input: {
    description: string
    currency: string
    quantity: number
    unitPriceAmountCents: number
    totalAmountCents: number
  }) => Promise<void>
  onUpdate: (
    lineId: string,
    input: Partial<{
      description: string
      quantity: number
      unitPriceAmountCents: number
      totalAmountCents: number
    }>,
  ) => Promise<void>
  onRemove: (lineId: string) => Promise<void>
}

export function QuoteVersionLinesCard({
  currency,
  lines,
  isLoading,
  editable = true,
  onCreate,
  onUpdate,
  onRemove,
}: QuoteVersionLinesCardProps) {
  const [newDescription, setNewDescription] = useState("")
  const [newQuantity, setNewQuantity] = useState("1")
  const [newPrice, setNewPrice] = useState("0")
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAdd() {
    const desc = newDescription.trim()
    if (!desc) {
      setError("Description is required")
      return
    }
    const qty = Number.parseInt(newQuantity, 10) || 1
    const price = Number.parseInt(newPrice, 10) || 0
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
      setNewPrice("0")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add line")
    } finally {
      setAdding(false)
    }
  }

  const subtotal = lines.reduce((sum, line) => sum + line.totalAmountCents, 0)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Line items</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : lines.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No line items yet.</p>
        ) : (
          <ul className="divide-y">
            {lines.map((line) => (
              <QuoteVersionLineRow
                key={line.id}
                line={line}
                editable={editable}
                onUpdate={(input) => onUpdate(line.id, input)}
                onRemove={() => onRemove(line.id)}
              />
            ))}
          </ul>
        )}

        {editable ? (
          <div className="mt-3 flex flex-col gap-2 border-t pt-3">
            <div className="grid grid-cols-12 gap-2">
              <Input
                className="col-span-6 h-8 text-sm"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Description"
              />
              <Input
                className="col-span-2 h-8 text-sm"
                type="number"
                min={1}
                value={newQuantity}
                onChange={(e) => setNewQuantity(e.target.value)}
                placeholder="Qty"
              />
              <Input
                className="col-span-3 h-8 text-sm"
                type="number"
                min={0}
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="Price (cents)"
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
        ) : null}

        <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-semibold">{formatMoney(subtotal, currency)}</span>
        </div>
      </CardContent>
    </Card>
  )
}

function QuoteVersionLineRow({
  line,
  editable,
  onUpdate,
  onRemove,
}: {
  line: QuoteVersionLineRecord
  editable: boolean
  onUpdate: (input: {
    description?: string
    quantity?: number
    unitPriceAmountCents?: number
    totalAmountCents?: number
  }) => Promise<void>
  onRemove: () => Promise<void>
}) {
  const [removing, setRemoving] = useState(false)

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
    if (!Number.isFinite(qty) || qty < 1) return
    await onUpdate({
      quantity: qty,
      totalAmountCents: qty * line.unitPriceAmountCents,
    })
  }

  async function handlePrice(value: string) {
    const price = Number.parseInt(value, 10)
    if (!Number.isFinite(price) || price < 0) return
    await onUpdate({
      unitPriceAmountCents: price,
      totalAmountCents: line.quantity * price,
    })
  }

  return (
    <li className="py-2">
      <div className="grid grid-cols-12 items-center gap-2">
        <Input
          className="col-span-6 h-8 text-sm"
          defaultValue={line.description}
          disabled={!editable}
          onBlur={(e) => {
            const value = e.target.value.trim()
            if (value && value !== line.description) void onUpdate({ description: value })
          }}
        />
        <Input
          className="col-span-2 h-8 text-sm"
          type="number"
          min={1}
          defaultValue={line.quantity}
          disabled={!editable}
          onBlur={(e) => void handleQuantity(e.target.value)}
        />
        <Input
          className="col-span-2 h-8 text-sm"
          type="number"
          min={0}
          defaultValue={line.unitPriceAmountCents}
          disabled={!editable}
          onBlur={(e) => void handlePrice(e.target.value)}
        />
        <span className="col-span-1 text-right text-sm font-medium">
          {formatMoney(line.totalAmountCents, line.currency)}
        </span>
        {editable ? (
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
        ) : null}
      </div>
    </li>
  )
}
