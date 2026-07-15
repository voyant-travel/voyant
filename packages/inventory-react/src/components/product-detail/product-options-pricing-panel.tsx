import { useMutation, useQuery } from "@tanstack/react-query"
import { formatMessage } from "@voyant-travel/i18n"
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@voyant-travel/ui/components"
import { ChevronDown, ChevronRight, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import type * as React from "react"
import { useState } from "react"
import { useOptionPriceRuleMutation } from "./commerce-client.js"
import { useProductDetailApi, useProductDetailMessages } from "./host.js"
import type { OptionPriceRuleData } from "./product-option-price-rule-dialog.js"
import { OptionPriceRuleDialog } from "./product-option-price-rule-dialog.js"
import { OptionPricingGrid } from "./product-option-pricing-grid.js"
import { ExtraPriceRulesPanel } from "./product-options-extra-price-rules.js"
import { formatProductMoney } from "./product-options-pricing-helpers.js"
import {
  getProductDetailOptionPriceRulesQueryOptions,
  type OptionPricingLayout,
} from "./product-options-shared.js"
import { UnitPriceMatrix } from "./product-options-unit-price-matrix.js"

function getRulePricingModeLabel(
  value: OptionPriceRuleData["pricingMode"],
  messages: ReturnType<typeof useProductDetailMessages>["products"]["operations"]["priceRules"],
) {
  switch (value) {
    case "per_person":
      return messages.pricingModePerPerson
    case "per_booking":
      return messages.pricingModePerBooking
    case "starting_from":
      return messages.pricingModeStartingFrom
    case "free":
      return messages.pricingModeFree
    case "on_request":
      return messages.pricingModeOnRequest
    default:
      return value
  }
}

function ActionMenu({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          title={label}
          className="h-8 w-8 text-muted-foreground"
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Per-option pricing surface. The everyday view is the merged rooms/seats
 * grid; the full rate-plan machinery (multiple plans, catalogs, cost prices,
 * cancellation) plus any injected per-departure inventory live behind an
 * Advanced disclosure so low-tech agents never have to see them.
 */
export function PricingPanel({
  productId,
  optionId,
  optionName,
  productCurrency,
  layout,
  extras,
}: {
  productId: string
  optionId: string
  optionName: string
  productCurrency: string
  layout: OptionPricingLayout
  extras?: React.ReactNode
}) {
  const messages = useProductDetailMessages()
  const gridMessages = messages.products.operations.pricingGrid
  const [advancedOpen, setAdvancedOpen] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      <OptionPricingGrid
        productId={productId}
        optionId={optionId}
        optionName={optionName}
        productCurrency={productCurrency}
        layout={layout}
      />

      <div className="rounded-md border bg-background/60">
        <button
          type="button"
          onClick={() => setAdvancedOpen((open) => !open)}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {advancedOpen ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
          <span>{gridMessages.advancedToggle}</span>
          {!advancedOpen ? (
            <span className="font-normal normal-case">— {gridMessages.advancedHint}</span>
          ) : null}
        </button>
        {advancedOpen ? (
          <div className="flex flex-col gap-4 border-t p-3">
            <AdvancedRatePlans
              productId={productId}
              optionId={optionId}
              productCurrency={productCurrency}
            />
          </div>
        ) : null}
      </div>

      {/* Per-departure inventory is its own concern (not a pricing/rate-plan
          setting), so it lives in its own collapsible slot below Advanced. */}
      {extras}
    </div>
  )
}

function AdvancedRatePlans({
  productId,
  optionId,
  productCurrency,
}: {
  productId: string
  optionId: string
  productCurrency: string
}) {
  const messages = useProductDetailMessages()
  const api = useProductDetailApi()
  const priceRuleMessages = messages.products.operations.priceRules
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<OptionPriceRuleData | undefined>()
  const { data, refetch } = useQuery(getProductDetailOptionPriceRulesQueryOptions(api, optionId))
  const { remove: removeRule } = useOptionPriceRuleMutation()
  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeRule.mutateAsync(id),
    onSuccess: () => void refetch(),
  })
  const rules = data?.data ?? []
  // The default rate plan IS the everyday grid above — don't re-render its
  // identical matrix here. Advanced only manages the *extra* plans (net,
  // contract, promo) plus the default plan's hidden settings (cost,
  // cancellation, catalog) via "Edit default pricing".
  const defaultRule = rules.find((rule) => rule.isDefault) ?? rules[0]
  const additionalRules = rules.filter((rule) => rule.id !== defaultRule?.id)

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {priceRuleMessages.additionalSectionTitle}
          </p>
          <p className="text-xs text-muted-foreground">
            {priceRuleMessages.additionalSectionDescription}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {defaultRule ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingRule(defaultRule)
                setRuleDialogOpen(true)
              }}
            >
              {priceRuleMessages.editDefaultAction}
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingRule(undefined)
              setRuleDialogOpen(true)
            }}
          >
            <Plus className="mr-1 h-3 w-3" />
            {priceRuleMessages.addAction}
          </Button>
        </div>
      </div>

      {additionalRules.length === 0 ? (
        <p className="py-2 text-center text-xs text-muted-foreground">
          {priceRuleMessages.additionalEmpty}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {additionalRules.map((rule) => (
            <PriceRuleCard
              key={rule.id}
              rule={rule}
              productId={productId}
              optionId={optionId}
              productCurrency={productCurrency}
              onEdit={() => {
                setEditingRule(rule)
                setRuleDialogOpen(true)
              }}
              onDelete={() => {
                if (
                  confirm(formatMessage(priceRuleMessages.deleteRuleConfirm, { name: rule.name }))
                ) {
                  deleteMutation.mutate(rule.id)
                }
              }}
            />
          ))}
        </div>
      )}

      <OptionPriceRuleDialog
        open={ruleDialogOpen}
        onOpenChange={setRuleDialogOpen}
        productId={productId}
        optionId={optionId}
        rule={editingRule}
        onSuccess={() => {
          setRuleDialogOpen(false)
          setEditingRule(undefined)
          void refetch()
        }}
      />
    </div>
  )
}

function PriceRuleCard({
  rule,
  productId,
  optionId,
  productCurrency,
  onEdit,
  onDelete,
}: {
  rule: OptionPriceRuleData
  productId: string
  optionId: string
  productCurrency: string
  onEdit: () => void
  onDelete: () => void
}) {
  const messages = useProductDetailMessages()
  const priceRuleMessages = messages.products.operations.priceRules
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{rule.name}</span>
            <Badge variant="outline" className="text-xs capitalize">
              {getRulePricingModeLabel(rule.pricingMode, priceRuleMessages)}
            </Badge>
            {rule.isDefault && <Badge variant="secondary">{priceRuleMessages.defaultBadge}</Badge>}
            <Badge variant={rule.active ? "default" : "outline"}>
              {rule.active ? priceRuleMessages.activeBadge : priceRuleMessages.inactiveBadge}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              {priceRuleMessages.baseSellLabel}:{" "}
              <span className="font-mono text-foreground">
                {formatProductMoney(rule.baseSellAmountCents, productCurrency)}
              </span>
            </span>
            <span>
              {priceRuleMessages.baseCostLabel}:{" "}
              <span className="font-mono text-foreground">
                {formatProductMoney(rule.baseCostAmountCents, productCurrency)}
              </span>
            </span>
            {rule.allPricingCategories && <span>{priceRuleMessages.allCategoriesLabel}</span>}
          </div>
        </div>
        <ActionMenu
          label={`${rule.name}: ${priceRuleMessages.editAction} / ${priceRuleMessages.deleteAction}`}
        >
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="h-4 w-4" />
            {priceRuleMessages.editAction}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
            {priceRuleMessages.deleteAction}
          </DropdownMenuItem>
        </ActionMenu>
      </div>

      <div className="mt-3">
        <UnitPriceMatrix
          productId={productId}
          optionPriceRuleId={rule.id}
          optionId={optionId}
          pricingMode={rule.pricingMode}
          allPricingCategories={rule.allPricingCategories}
          productCurrency={productCurrency}
        />
        <ExtraPriceRulesPanel
          productId={productId}
          optionId={optionId}
          optionPriceRuleId={rule.id}
          productCurrency={productCurrency}
        />
      </div>
    </div>
  )
}
