// agent-quality: file-size exception -- owner: promotions-react; existing UI surface stays co-located until a dedicated split preserves behavior and tests.
"use client"

/**
 * Create / edit dialog for a promotional offer.
 *
 * The discriminated-union scope picker renders first-class product/category
 * pickers where the inventory package can resolve records, and falls back to
 * validated reference entry for the remaining scope kinds.
 */

import { formatMessage } from "@voyant-travel/i18n"
import { useProduct, useProductCategory } from "@voyant-travel/inventory-react"
import { ProductCategoryCombobox, ProductCombobox } from "@voyant-travel/inventory-react/ui"
import {
  Badge,
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
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Switch,
  Textarea,
} from "@voyant-travel/ui/components"
import { CurrencyCombobox } from "@voyant-travel/ui/components/currency-combobox"
import { CurrencyInput } from "@voyant-travel/ui/components/currency-input"
import { DateTimePicker } from "@voyant-travel/ui/components/date-time-picker"
import { X } from "lucide-react"
import { type ReactNode, useEffect, useState } from "react"
import type { PromotionsUiMessages } from "./i18n/messages.js"
import { usePromotionsUiMessagesOrDefault } from "./i18n/provider.js"
import {
  type PromotionalOfferRecord,
  type PromotionalOfferScopeKind,
  useCreatePromotion,
  useUpdatePromotion,
} from "./index.js"
import {
  AUDIENCE_OPTIONS,
  buildPromotionPayload,
  emptyPromotionForm,
  offerToPromotionForm,
  type PromotionFormState,
  parseScopeIds,
  SCOPE_KINDS,
  type ScopeKind,
  scopeIdsToFormValue,
} from "./promotion-dialog-model.js"

export interface PromotionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When provided, the dialog opens in edit mode. */
  offer?: PromotionalOfferRecord
}

export function PromotionDialog({ open, onOpenChange, offer }: PromotionDialogProps) {
  const messages = usePromotionsUiMessagesOrDefault()
  const dialogMessages = messages.promotionDialog
  const [state, setState] = useState<PromotionFormState>(emptyPromotionForm())
  const [error, setError] = useState<string | null>(null)
  const createMutation = useCreatePromotion()
  const updateMutation = useUpdatePromotion()
  const isEdit = offer != null
  const isPending = createMutation.isPending || updateMutation.isPending

  // Re-seed form whenever the dialog opens with a different offer.
  useEffect(() => {
    if (!open) return
    setError(null)
    setState(offer ? offerToPromotionForm(offer) : emptyPromotionForm())
  }, [open, offer])

  function setField<K extends keyof PromotionFormState>(key: K, value: PromotionFormState[K]) {
    setState((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setError(null)
    const result = buildPromotionPayload(
      state,
      dialogMessages,
      scopeIdsLabel(state.scopeKind, messages.common.scopeKindLabels),
    )
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="max-w-2xl">
        <SheetHeader>
          <SheetTitle>
            {isEdit ? dialogMessages.titles.edit : dialogMessages.titles.create}
          </SheetTitle>
          <SheetDescription>{dialogMessages.description}</SheetDescription>
        </SheetHeader>

        <SheetBody className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="promotion-name">{dialogMessages.fields.name}</Label>
              <Input
                id="promotion-name"
                value={state.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder={dialogMessages.placeholders.name}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="promotion-slug">{dialogMessages.fields.slug}</Label>
              <Input
                id="promotion-slug"
                value={state.slug}
                onChange={(e) => setField("slug", e.target.value)}
                placeholder={dialogMessages.placeholders.slug}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="promotion-description">{dialogMessages.fields.description}</Label>
            <Textarea
              id="promotion-description"
              value={state.description}
              onChange={(e) => setField("description", e.target.value)}
              rows={2}
              placeholder={dialogMessages.placeholders.description}
            />
          </div>

          {/* Discount block */}
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label>{dialogMessages.fields.type}</Label>
              <Select
                value={state.discountType}
                onValueChange={(v) => {
                  if (v === "percentage" || v === "fixed_amount") setField("discountType", v)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">
                    {messages.common.discountTypeLabels.percentage}
                  </SelectItem>
                  <SelectItem value="fixed_amount">
                    {messages.common.discountTypeLabels.fixed_amount}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {state.discountType === "percentage" ? (
              <div className="grid gap-1.5">
                <Label htmlFor="promotion-percent">{dialogMessages.fields.percent}</Label>
                <Input
                  id="promotion-percent"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={state.discountPercent}
                  onChange={(e) => setField("discountPercent", e.target.value)}
                  placeholder={dialogMessages.placeholders.percent}
                />
              </div>
            ) : (
              <>
                <div className="grid gap-1.5">
                  <Label htmlFor="promotion-amount">{dialogMessages.fields.amount}</Label>
                  <CurrencyInput
                    id="promotion-amount"
                    value={state.discountAmountCents}
                    onChange={(value) => setField("discountAmountCents", value)}
                    currency={state.currency}
                    placeholder={dialogMessages.placeholders.amount}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="promotion-currency">{dialogMessages.fields.currency}</Label>
                  <CurrencyCombobox
                    value={state.currency || null}
                    onChange={(next) => setField("currency", next ?? "")}
                    placeholder={dialogMessages.placeholders.currency}
                  />
                </div>
              </>
            )}
          </div>

          {/* Scope picker — discriminated union */}
          <div className="grid gap-1.5">
            <Label>{dialogMessages.fields.scope}</Label>
            <Select
              value={state.scopeKind}
              onValueChange={(v) => {
                if (v != null && SCOPE_KINDS.includes(v as ScopeKind)) {
                  setField("scopeKind", v as ScopeKind)
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCOPE_KINDS.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {messages.common.scopeKindLabels[kind]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {state.scopeKind === "global" ? (
              <p className="text-sm text-muted-foreground">{dialogMessages.hints.globalScope}</p>
            ) : null}

            {state.scopeKind === "products" ? (
              <ProductScopePicker
                ids={parseScopeIds(state.scopeIds)}
                onIdsChange={(ids) => setField("scopeIds", scopeIdsToFormValue(ids))}
                messages={dialogMessages}
              />
            ) : null}

            {state.scopeKind === "categories" ? (
              <CategoryScopePicker
                ids={parseScopeIds(state.scopeIds)}
                onIdsChange={(ids) => setField("scopeIds", scopeIdsToFormValue(ids))}
                messages={dialogMessages}
              />
            ) : null}

            {(state.scopeKind === "destinations" ||
              state.scopeKind === "markets" ||
              state.scopeKind === "fare_codes" ||
              state.scopeKind === "cabin_grades") && (
              <div className="grid gap-1.5">
                <Label htmlFor="promotion-scope-ids">
                  {formatMessage(dialogMessages.fields.scopeIds, {
                    scope: scopeIdsLabel(state.scopeKind, messages.common.scopeKindLabels),
                  })}
                </Label>
                <Input
                  id="promotion-scope-ids"
                  value={state.scopeIds}
                  onChange={(e) => setField("scopeIds", e.target.value)}
                  placeholder={scopeIdsPlaceholder(state.scopeKind, dialogMessages.placeholders)}
                />
              </div>
            )}

            {state.scopeKind === "audiences" && (
              <div className="grid gap-2">
                <Label>{dialogMessages.fields.audiences}</Label>
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
                        {messages.common.audienceLabels[audience]}
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
              <Label htmlFor="promotion-valid-from">{dialogMessages.fields.validFrom}</Label>
              <DateTimePicker
                value={state.validFrom}
                onChange={(nextValue) => setField("validFrom", nextValue ?? "")}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="promotion-valid-until">{dialogMessages.fields.validUntil}</Label>
              <DateTimePicker
                value={state.validUntil}
                onChange={(nextValue) => setField("validUntil", nextValue ?? "")}
              />
            </div>
          </div>

          {/* Code + stacking + minPax + active */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="promotion-code">{dialogMessages.fields.code}</Label>
              <Input
                id="promotion-code"
                value={state.code}
                onChange={(e) => setField("code", e.target.value)}
                placeholder={dialogMessages.placeholders.code}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="promotion-min-pax">{dialogMessages.fields.minPax}</Label>
              <Input
                id="promotion-min-pax"
                type="number"
                min="1"
                step="1"
                value={state.minPax}
                onChange={(e) => setField("minPax", e.target.value)}
                placeholder={dialogMessages.placeholders.minPax}
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
              <Label htmlFor="promotion-stackable">{dialogMessages.fields.stackable}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="promotion-active"
                checked={state.active}
                onCheckedChange={(v) => setField("active", Boolean(v))}
              />
              <Label htmlFor="promotion-active">{dialogMessages.fields.active}</Label>
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </SheetBody>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {messages.common.cancel}
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending
              ? messages.common.saving
              : isEdit
                ? messages.common.saveChanges
                : messages.common.create}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function scopeIdsLabel(
  kind: PromotionalOfferScopeKind,
  labels: Record<PromotionalOfferScopeKind, string>,
): string {
  return labels[kind]
}

function scopeIdsPlaceholder(
  kind: "products" | "categories" | "destinations" | "markets" | "fare_codes" | "cabin_grades",
  placeholders: PromotionsUiMessages["promotionDialog"]["placeholders"],
): string {
  switch (kind) {
    case "products":
      return placeholders.productIds
    case "categories":
      return placeholders.categoryIds
    case "destinations":
      return placeholders.destinationIds
    case "markets":
      return placeholders.marketIds
    case "fare_codes":
      return placeholders.fareCodes
    case "cabin_grades":
      return placeholders.cabinGradeCodes
  }
}

function ProductScopePicker({
  ids,
  onIdsChange,
  messages,
}: {
  ids: string[]
  onIdsChange: (ids: string[]) => void
  messages: PromotionsUiMessages["promotionDialog"]
}) {
  return (
    <div className="grid gap-2">
      <Label>{messages.fields.products}</Label>
      <ProductCombobox
        value={null}
        onChange={(id) => {
          if (id && !ids.includes(id)) onIdsChange([...ids, id])
        }}
        placeholder={messages.placeholders.productPicker}
      />
      <SelectedScopeBadges
        ids={ids}
        renderLabel={(id) => <SelectedProductLabel id={id} />}
        onRemove={(id) => onIdsChange(ids.filter((candidate) => candidate !== id))}
        emptyText={messages.hints.noProductsSelected}
        removeLabel={messages.actions.removeScopeId}
      />
    </div>
  )
}

function CategoryScopePicker({
  ids,
  onIdsChange,
  messages,
}: {
  ids: string[]
  onIdsChange: (ids: string[]) => void
  messages: PromotionsUiMessages["promotionDialog"]
}) {
  return (
    <div className="grid gap-2">
      <Label>{messages.fields.categories}</Label>
      <ProductCategoryCombobox
        value={null}
        onChange={(id) => {
          if (id && !ids.includes(id)) onIdsChange([...ids, id])
        }}
        placeholder={messages.placeholders.categoryPicker}
      />
      <SelectedScopeBadges
        ids={ids}
        renderLabel={(id) => <SelectedCategoryLabel id={id} />}
        onRemove={(id) => onIdsChange(ids.filter((candidate) => candidate !== id))}
        emptyText={messages.hints.noCategoriesSelected}
        removeLabel={messages.actions.removeScopeId}
      />
    </div>
  )
}

function SelectedScopeBadges({
  ids,
  renderLabel,
  onRemove,
  emptyText,
  removeLabel,
}: {
  ids: string[]
  renderLabel: (id: string) => ReactNode
  onRemove: (id: string) => void
  emptyText: string
  removeLabel: string
}) {
  if (ids.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>
  }

  return (
    <div className="flex flex-wrap gap-2">
      {ids.map((id) => (
        <Badge key={id} variant="secondary" className="gap-1 pr-1">
          <span className="max-w-56 truncate">{renderLabel(id)}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-5 rounded-full"
            onClick={() => onRemove(id)}
            aria-label={formatMessage(removeLabel, { id })}
          >
            <X className="size-3" aria-hidden="true" />
          </Button>
        </Badge>
      ))}
    </div>
  )
}

function SelectedProductLabel({ id }: { id: string }) {
  const query = useProduct(id, { enabled: Boolean(id) })
  return <>{query.data?.name ?? id}</>
}

function SelectedCategoryLabel({ id }: { id: string }) {
  const query = useProductCategory(id, { enabled: Boolean(id) })
  return <>{query.data?.name ?? id}</>
}
