import { useProductExtras } from "@voyantjs/extras-react"
import {
  type ExtraPriceRuleRecord,
  useExtraPriceRuleMutation,
  useExtraPriceRules,
} from "@voyantjs/pricing-react"
import {
  Button,
  Dialog,
  DialogBody,
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
} from "@voyantjs/ui/components"
import { useEffect, useState } from "react"
import { useAdminMessages } from "@/lib/admin-i18n"

export function ExtraPriceRulesPanel({
  productId,
  optionId,
  optionPriceRuleId,
  productCurrency,
}: {
  productId: string
  optionId: string
  optionPriceRuleId: string
  productCurrency: string
}) {
  const messages = useAdminMessages()
  const extraPriceMessages = messages.products.operations.extraPrices
  const extrasQuery = useProductExtras({ productId, active: true, limit: 100 })
  const rulesQuery = useExtraPriceRules({ optionPriceRuleId, optionId, active: true, limit: 100 })
  const { remove } = useExtraPriceRuleMutation()
  const [pricingExtraId, setPricingExtraId] = useState<string | null>(null)
  const extras = extrasQuery.data?.data ?? []
  const rules = rulesQuery.data?.data ?? []
  const ruleByExtraId = new Map(
    rules.flatMap((rule) => (rule.productExtraId ? [[rule.productExtraId, rule] as const] : [])),
  )

  if (extras.length === 0) return null
  const pricingExtra = extras.find((extra) => extra.id === pricingExtraId) ?? null

  return (
    <div className="mt-4 border-t pt-3">
      <div className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {extraPriceMessages.sectionTitle}
      </div>
      <div className="flex flex-col gap-2">
        {extras.map((extra) => {
          const rule = ruleByExtraId.get(extra.id)
          return (
            <div
              key={extra.id}
              className="flex items-center justify-between gap-3 rounded border px-2 py-1.5 text-xs"
            >
              <div className="min-w-0">
                <span className="font-medium">{extra.name}</span>
                {extra.pricedPerPerson ? (
                  <span className="ml-2 text-muted-foreground">
                    {extraPriceMessages.perTraveler}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono">
                  {rule?.sellAmountCents != null
                    ? formatProductMoney(rule.sellAmountCents, productCurrency)
                    : extraPriceMessages.noAmount}
                </span>
                <Button variant="outline" size="sm" onClick={() => setPricingExtraId(extra.id)}>
                  {extraPriceMessages.setPrice}
                </Button>
                {rule ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      remove.mutate(rule.id, { onSuccess: () => void rulesQuery.refetch() })
                    }
                  >
                    {extraPriceMessages.remove}
                  </Button>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
      {pricingExtra ? (
        <ExtraPriceRuleDialog
          open={!!pricingExtra}
          onOpenChange={(open) => {
            if (!open) setPricingExtraId(null)
          }}
          optionPriceRuleId={optionPriceRuleId}
          optionId={optionId}
          extra={pricingExtra}
          existingRule={ruleByExtraId.get(pricingExtra.id)}
          nextSortOrder={rules.length}
          productCurrency={productCurrency}
          onSuccess={() => {
            setPricingExtraId(null)
            void rulesQuery.refetch()
          }}
        />
      ) : null}
    </div>
  )
}

function ExtraPriceRuleDialog({
  open,
  onOpenChange,
  optionPriceRuleId,
  optionId,
  extra,
  existingRule,
  nextSortOrder,
  productCurrency,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  optionPriceRuleId: string
  optionId: string
  extra: { id: string; name: string; pricingMode: string; pricedPerPerson: boolean }
  existingRule?: ExtraPriceRuleRecord
  nextSortOrder: number
  productCurrency: string
  onSuccess: () => void
}) {
  const messages = useAdminMessages()
  const extraPriceMessages = messages.products.operations.extraPrices
  const { create, update } = useExtraPriceRuleMutation()
  const [amount, setAmount] = useState("")
  const [pricingMode, setPricingMode] = useState<ExtraPriceRuleRecord["pricingMode"]>("per_booking")

  const isEditing = !!existingRule
  const pricingModes = [
    { value: "per_booking", label: extraPriceMessages.pricingPerBooking },
    { value: "per_person", label: extraPriceMessages.pricingPerPerson },
    { value: "included", label: extraPriceMessages.pricingIncluded },
    { value: "on_request", label: extraPriceMessages.pricingOnRequest },
    { value: "unavailable", label: extraPriceMessages.pricingUnavailable },
  ] as const

  useEffect(() => {
    setAmount(
      existingRule?.sellAmountCents != null ? String(existingRule.sellAmountCents / 100) : "",
    )
    setPricingMode(existingRule?.pricingMode ?? defaultExtraPriceRuleMode(extra))
  }, [existingRule, extra])

  const save = async () => {
    const parsedAmount = amount.trim() === "" ? null : Math.round(Number(amount) * 100)
    if (parsedAmount != null && (!Number.isFinite(parsedAmount) || parsedAmount < 0)) return
    const payload = {
      optionPriceRuleId,
      optionId,
      productExtraId: extra.id,
      optionExtraConfigId: null,
      pricingMode,
      sellAmountCents: parsedAmount,
      costAmountCents: null,
      active: true,
      sortOrder: existingRule?.sortOrder ?? nextSortOrder,
    }
    if (existingRule) await update.mutateAsync({ id: existingRule.id, input: payload })
    else await create.mutateAsync(payload)
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? extraPriceMessages.editTitle : extraPriceMessages.newTitle}
          </DialogTitle>
          <DialogDescription>{extra.name}</DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          <div className="flex flex-col gap-2">
            <Label>{extraPriceMessages.pricingModeLabel}</Label>
            <Select
              value={pricingMode}
              onValueChange={(value) =>
                setPricingMode((value ?? "per_booking") as ExtraPriceRuleRecord["pricingMode"])
              }
              items={pricingModes}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pricingModes.map((mode) => (
                  <SelectItem key={mode.value} value={mode.value}>
                    {mode.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>{extraPriceMessages.sellAmountLabel}</Label>
            <div className="flex items-center gap-2">
              <Input
                value={amount}
                type="number"
                min="0"
                step="0.01"
                onChange={(event) => setAmount(event.target.value)}
              />
              <span className="min-w-12 text-muted-foreground text-sm">{productCurrency}</span>
            </div>
          </div>
        </DialogBody>
        <DialogFooter className="-mx-6 -mb-6">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {extraPriceMessages.cancel}
          </Button>
          <Button onClick={() => void save()}>{extraPriceMessages.save}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function defaultExtraPriceRuleMode(extra: {
  pricingMode: string
  pricedPerPerson: boolean
}): ExtraPriceRuleRecord["pricingMode"] {
  if (extra.pricedPerPerson || extra.pricingMode === "per_person") return "per_person"
  if (extra.pricingMode === "included" || extra.pricingMode === "free") return "included"
  if (extra.pricingMode === "on_request") return "on_request"
  return "per_booking"
}

function formatProductMoney(amountCents: number | null | undefined, currency: string) {
  if (amountCents == null) return "-"
  return `${(amountCents / 100).toFixed(2)} ${currency}`
}
