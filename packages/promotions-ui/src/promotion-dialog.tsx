"use client"

/**
 * Create / edit dialog for a promotional offer.
 *
 * The discriminated-union scope picker is the trickiest piece here:
 * a `kind` dropdown plus per-kind sub-fields rendered conditionally.
 * Comma-separated text input for ID lists (productIds, marketIds, etc.)
 * keeps the v1 UX simple — a future PR can swap in proper combobox-with-
 * search components per scope kind.
 */

import {
  type PromotionalOfferRecord,
  type PromotionalOfferScope,
  type PromotionInsertInput,
  promotionalOfferScopeSchema,
  useCreatePromotion,
  useUpdatePromotion,
} from "@voyantjs/promotions-react"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
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
  Switch,
  Textarea,
} from "@voyantjs/ui/components"
import { CurrencyInput } from "@voyantjs/ui/components/currency-input"
import { DateTimePicker } from "@voyantjs/ui/components/date-time-picker"
import { useEffect, useState } from "react"

export interface PromotionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When provided, the dialog opens in edit mode. */
  offer?: PromotionalOfferRecord
}

type ScopeKind = PromotionalOfferScope["kind"]

const SCOPE_KINDS: ScopeKind[] = [
  "global",
  "products",
  "categories",
  "destinations",
  "markets",
  "audiences",
]

const AUDIENCE_OPTIONS: Array<"staff" | "customer" | "partner" | "supplier"> = [
  "staff",
  "customer",
  "partner",
  "supplier",
]

interface FormState {
  name: string
  slug: string
  description: string
  discountType: "percentage" | "fixed_amount"
  discountPercent: string
  discountAmountCents: number | null
  currency: string
  scopeKind: ScopeKind
  scopeIds: string // comma-separated for products/categories/destinations/markets
  scopeAudiences: Array<"staff" | "customer" | "partner" | "supplier">
  minPax: string
  validFrom: string
  validUntil: string
  code: string
  stackable: boolean
  active: boolean
}

function emptyForm(): FormState {
  return {
    name: "",
    slug: "",
    description: "",
    discountType: "percentage",
    discountPercent: "",
    discountAmountCents: null,
    currency: "USD",
    scopeKind: "global",
    scopeIds: "",
    scopeAudiences: ["customer"],
    minPax: "",
    validFrom: "",
    validUntil: "",
    code: "",
    stackable: false,
    active: true,
  }
}

function offerToForm(offer: PromotionalOfferRecord): FormState {
  const base = emptyForm()
  base.name = offer.name
  base.slug = offer.slug
  base.description = offer.description ?? ""
  base.discountType = offer.discountType
  base.discountPercent = offer.discountPercent ?? ""
  base.discountAmountCents = offer.discountAmountCents ?? null
  base.currency = offer.currency ?? "USD"
  base.scopeKind = offer.scope.kind
  base.scopeIds = scopeIdsToString(offer.scope)
  base.scopeAudiences = offer.scope.kind === "audiences" ? [...offer.scope.audiences] : ["customer"]
  base.minPax = offer.conditions.minPax != null ? String(offer.conditions.minPax) : ""
  base.validFrom = offer.validFrom ? toDateTimePickerValue(offer.validFrom) : ""
  base.validUntil = offer.validUntil ? toDateTimePickerValue(offer.validUntil) : ""
  base.code = offer.code ?? ""
  base.stackable = offer.stackable
  base.active = offer.active
  return base
}

function scopeIdsToString(scope: PromotionalOfferScope): string {
  switch (scope.kind) {
    case "products":
      return scope.productIds.join(", ")
    case "categories":
      return scope.categoryIds.join(", ")
    case "destinations":
      return scope.destinationIds.join(", ")
    case "markets":
      return scope.marketIds.join(", ")
    default:
      return ""
  }
}

function toDateTimePickerValue(iso: string): string {
  // DateTimePicker values use `YYYY-MM-DDTHH:mm` with no timezone.
  return iso.slice(0, 16)
}

function buildScope(state: FormState): PromotionalOfferScope {
  switch (state.scopeKind) {
    case "global":
      return { kind: "global" }
    case "products":
      return { kind: "products", productIds: parseIds(state.scopeIds) }
    case "categories":
      return { kind: "categories", categoryIds: parseIds(state.scopeIds) }
    case "destinations":
      return { kind: "destinations", destinationIds: parseIds(state.scopeIds) }
    case "markets":
      return { kind: "markets", marketIds: parseIds(state.scopeIds) }
    case "audiences":
      return { kind: "audiences", audiences: state.scopeAudiences }
  }
}

function parseIds(raw: string): string[] {
  return raw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

function buildPayload(state: FormState): PromotionInsertInput | { error: string } {
  if (!state.name.trim()) return { error: "Name is required" }
  if (!state.slug.trim()) return { error: "Slug is required" }
  if (state.discountType === "percentage" && !state.discountPercent) {
    return { error: "Discount percent is required for percentage offers" }
  }
  if (state.discountType === "fixed_amount") {
    if (state.discountAmountCents == null || state.discountAmountCents <= 0) {
      return { error: "Discount amount is required for fixed-amount offers" }
    }
    if (!state.currency.trim()) return { error: "Currency is required for fixed-amount offers" }
  }

  // Validate scope shape via Zod so the user gets clear errors when (e.g.)
  // a products scope has an empty ID list.
  const scope = buildScope(state)
  const scopeResult = promotionalOfferScopeSchema.safeParse(scope)
  if (!scopeResult.success) {
    return { error: `Scope: ${scopeResult.error.issues[0]?.message ?? "invalid"}` }
  }

  const payload: PromotionInsertInput = {
    name: state.name.trim(),
    slug: state.slug.trim(),
    description: state.description.trim() || null,
    discountType: state.discountType,
    discountPercent: state.discountType === "percentage" ? Number(state.discountPercent) : null,
    discountAmountCents: state.discountType === "fixed_amount" ? state.discountAmountCents : null,
    currency: state.discountType === "fixed_amount" ? state.currency.trim().toUpperCase() : null,
    scope,
    conditions: state.minPax ? { minPax: Number(state.minPax) } : {},
    validFrom: state.validFrom ? new Date(state.validFrom).toISOString() : null,
    validUntil: state.validUntil ? new Date(state.validUntil).toISOString() : null,
    code: state.code.trim() || null,
    stackable: state.stackable,
    active: state.active,
  }
  return payload
}

export function PromotionDialog({ open, onOpenChange, offer }: PromotionDialogProps) {
  const [state, setState] = useState<FormState>(emptyForm())
  const [error, setError] = useState<string | null>(null)
  const createMutation = useCreatePromotion()
  const updateMutation = useUpdatePromotion()
  const isEdit = offer != null
  const isPending = createMutation.isPending || updateMutation.isPending

  // Re-seed form whenever the dialog opens with a different offer.
  useEffect(() => {
    if (!open) return
    setError(null)
    setState(offer ? offerToForm(offer) : emptyForm())
  }, [open, offer])

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setError(null)
    const result = buildPayload(state)
    if ("error" in result) {
      setError(result.error)
      return
    }
    try {
      if (isEdit && offer) {
        await updateMutation.mutateAsync({ id: offer.id, patch: result })
      } else {
        await createMutation.mutateAsync(result)
      }
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit promotion" : "New promotion"}</DialogTitle>
          <DialogDescription>
            Set discount, scope, and validity. Code-gated offers require a non-empty code; leave it
            blank for auto-applied offers.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="promotion-name">Name</Label>
              <Input
                id="promotion-name"
                value={state.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="Spring Sale 2026"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="promotion-slug">Slug</Label>
              <Input
                id="promotion-slug"
                value={state.slug}
                onChange={(e) => setField("slug", e.target.value)}
                placeholder="spring-sale-2026"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="promotion-description">Description</Label>
            <Textarea
              id="promotion-description"
              value={state.description}
              onChange={(e) => setField("description", e.target.value)}
              rows={2}
              placeholder="Internal note — what this offer is for"
            />
          </div>

          {/* Discount block */}
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label>Type</Label>
              <Select
                value={state.discountType}
                onValueChange={(v) => {
                  if (v === "percentage" || v === "fixed_amount") setField("discountType", v)
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage</SelectItem>
                  <SelectItem value="fixed_amount">Fixed amount</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {state.discountType === "percentage" ? (
              <div className="grid gap-1.5">
                <Label htmlFor="promotion-percent">Percent</Label>
                <Input
                  id="promotion-percent"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={state.discountPercent}
                  onChange={(e) => setField("discountPercent", e.target.value)}
                  placeholder="20"
                />
              </div>
            ) : (
              <>
                <div className="grid gap-1.5">
                  <Label htmlFor="promotion-amount">Amount</Label>
                  <CurrencyInput
                    id="promotion-amount"
                    value={state.discountAmountCents}
                    onChange={(value) => setField("discountAmountCents", value)}
                    currency={state.currency}
                    placeholder="5.00"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="promotion-currency">Currency</Label>
                  <Input
                    id="promotion-currency"
                    value={state.currency}
                    onChange={(e) => setField("currency", e.target.value)}
                    placeholder="USD"
                    maxLength={3}
                  />
                </div>
              </>
            )}
          </div>

          {/* Scope picker — discriminated union */}
          <div className="grid gap-1.5">
            <Label>Scope</Label>
            <Select
              value={state.scopeKind}
              onValueChange={(v) => {
                if (v != null && SCOPE_KINDS.includes(v as ScopeKind)) {
                  setField("scopeKind", v as ScopeKind)
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCOPE_KINDS.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {kind}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {state.scopeKind === "global" ? (
              <p className="text-sm text-muted-foreground">Applies to every product.</p>
            ) : null}

            {(state.scopeKind === "products" ||
              state.scopeKind === "categories" ||
              state.scopeKind === "destinations" ||
              state.scopeKind === "markets") && (
              <div className="grid gap-1.5">
                <Label htmlFor="promotion-scope-ids">
                  {scopeIdsLabel(state.scopeKind)} (comma-separated IDs)
                </Label>
                <Input
                  id="promotion-scope-ids"
                  value={state.scopeIds}
                  onChange={(e) => setField("scopeIds", e.target.value)}
                  placeholder={scopeIdsPlaceholder(state.scopeKind)}
                />
              </div>
            )}

            {state.scopeKind === "audiences" && (
              <div className="grid gap-2">
                <Label>Audiences</Label>
                <div className="flex flex-wrap gap-3">
                  {AUDIENCE_OPTIONS.map((audience) => {
                    const selected = state.scopeAudiences.includes(audience)
                    return (
                      <label key={audience} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...state.scopeAudiences, audience]
                              : state.scopeAudiences.filter((a) => a !== audience)
                            setField("scopeAudiences", next)
                          }}
                        />
                        {audience}
                      </label>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Validity window */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="promotion-valid-from">Valid from</Label>
              <DateTimePicker
                value={state.validFrom}
                onChange={(nextValue) => setField("validFrom", nextValue ?? "")}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="promotion-valid-until">Valid until</Label>
              <DateTimePicker
                value={state.validUntil}
                onChange={(nextValue) => setField("validUntil", nextValue ?? "")}
              />
            </div>
          </div>

          {/* Code + stacking + minPax + active */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="promotion-code">Code (optional)</Label>
              <Input
                id="promotion-code"
                value={state.code}
                onChange={(e) => setField("code", e.target.value)}
                placeholder="EARLYBIRD2026"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="promotion-min-pax">Min pax (optional)</Label>
              <Input
                id="promotion-min-pax"
                type="number"
                min="1"
                step="1"
                value={state.minPax}
                onChange={(e) => setField("minPax", e.target.value)}
                placeholder="4"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                id="promotion-stackable"
                checked={state.stackable}
                onCheckedChange={(v) => setField("stackable", Boolean(v))}
              />
              <Label htmlFor="promotion-stackable">Stackable with other offers</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="promotion-active"
                checked={state.active}
                onCheckedChange={(v) => setField("active", Boolean(v))}
              />
              <Label htmlFor="promotion-active">Active</Label>
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving…" : isEdit ? "Save changes" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function scopeIdsLabel(kind: "products" | "categories" | "destinations" | "markets"): string {
  switch (kind) {
    case "products":
      return "Product IDs"
    case "categories":
      return "Category IDs"
    case "destinations":
      return "Destination IDs"
    case "markets":
      return "Market IDs"
  }
}

function scopeIdsPlaceholder(kind: "products" | "categories" | "destinations" | "markets"): string {
  switch (kind) {
    case "products":
      return "prod_xxx, prod_yyy"
    case "categories":
      return "cat_xxx"
    case "destinations":
      return "dest_xxx"
    case "markets":
      return "mkt_xxx"
  }
}
