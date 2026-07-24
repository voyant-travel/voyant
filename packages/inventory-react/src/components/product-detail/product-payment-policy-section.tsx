"use client"

import type { PaymentPolicy } from "@voyant-travel/finance/payment-policy"
import { PaymentPolicyForm, PaymentPolicyPreview } from "@voyant-travel/finance-react/ui"
import { Badge, Button, Label, Switch } from "@voyant-travel/ui/components"
import { Separator } from "@voyant-travel/ui/components/separator"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { type ProductPaymentPolicy, type ProductRecord, useProductMutation } from "../../index.js"
import { useProductDetailMessages } from "./host.js"
import { Section } from "./product-detail-sections.js"

const DEFAULT_POLICY: PaymentPolicy = {
  deposit: { kind: "percent", percent: 50 },
  minDaysBeforeDepartureForDeposit: 30,
  balanceDueDaysBeforeDeparture: 30,
  balanceDueMinDaysFromNow: 7,
}

/**
 * Per-listing customer payment policy override for a product.
 *
 * Wins over the product's category and supplier policies in the
 * cascade — use this when a single product has stricter / looser
 * terms than the rest of its catalog group (a luxury-tier offering,
 * a flash sale, etc.).
 *
 * Inherit by default; flipping the toggle off saves an explicit
 * policy on the product row.
 */
export function ProductPaymentPolicySection({
  product,
  onSuccess,
}: {
  product: ProductRecord
  onSuccess?: () => void
}) {
  const t = useProductDetailMessages().products.operations.paymentPolicy
  const persisted = (product.customerPaymentPolicy as PaymentPolicy | null | undefined) ?? null
  const [draft, setDraft] = useState<PaymentPolicy | null>(persisted)
  const { update } = useProductMutation()

  // One-way sync: when the persisted policy reference changes (after
  // a save → query invalidation, or external edit), refresh the
  // draft. Mid-flight typing is preserved because we don't depend on
  // setState callbacks running on every render.
  useEffect(() => {
    setDraft(persisted)
  }, [persisted])

  const isInheriting = draft === null
  const isDirty = JSON.stringify(draft) !== JSON.stringify(persisted)

  const save = () => {
    update.mutate(
      {
        id: product.id,
        input: { customerPaymentPolicy: (draft as ProductPaymentPolicy | null) ?? null },
      },
      {
        onSuccess: () => {
          toast.success(t.savedToast)
          onSuccess?.()
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : t.saveFailed),
      },
    )
  }

  return (
    <Section
      title={t.title}
      actions={
        <Button size="sm" disabled={!isDirty || update.isPending} onClick={save}>
          {update.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t.save}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Label htmlFor="payment-policy-inherit" className="text-sm font-medium">
                {t.inheritLabel}
              </Label>
              <Badge variant={isInheriting ? "secondary" : "outline"} className="text-[10px]">
                {isInheriting ? t.inheritingBadge : t.customBadge}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{t.inheritHint}</p>
          </div>
          <Switch
            id="payment-policy-inherit"
            checked={isInheriting}
            onCheckedChange={(checked) => {
              setDraft(checked ? null : (draft ?? DEFAULT_POLICY))
            }}
            disabled={update.isPending}
          />
        </div>

        {isInheriting ? null : (
          <>
            <Separator />
            <PaymentPolicyForm
              value={draft}
              onChange={setDraft}
              inheritable={false}
              currency={product.sellCurrency}
              disabled={update.isPending}
            />
            <Separator />
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t.previewHeading}
              </p>
              <PaymentPolicyPreview policy={draft} currency={product.sellCurrency} />
            </div>
          </>
        )}
      </div>
    </Section>
  )
}
