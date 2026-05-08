"use client"

import type { PaymentPolicy } from "@voyantjs/finance"
import { PaymentPolicyForm, PaymentPolicyPreview } from "@voyantjs/finance-ui"
import {
  type ProductPaymentPolicy,
  type ProductRecord,
  useProductMutation,
} from "@voyantjs/products-react"
import { Badge, Button, Label, Switch } from "@voyantjs/ui/components"
import { Separator } from "@voyantjs/ui/components/separator"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Section } from "./product-detail-sections"

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
          toast.success("Customer payment policy saved")
          onSuccess?.()
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save policy"),
      },
    )
  }

  return (
    <Section
      title="Customer payment policy"
      actions={
        <Button size="sm" disabled={!isDirty || update.isPending} onClick={save}>
          {update.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Label htmlFor="payment-policy-inherit" className="text-sm font-medium">
                Inherit from parent
              </Label>
              <Badge variant={isInheriting ? "secondary" : "outline"} className="text-[10px]">
                {isInheriting ? "Inheriting" : "Custom"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              When on, falls back to the next-broader policy (category, supplier, operator default).
              Switch off to set an explicit policy on this product.
            </p>
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
                Preview
              </p>
              <PaymentPolicyPreview policy={draft} currency={product.sellCurrency} />
            </div>
          </>
        )}
      </div>
    </Section>
  )
}
