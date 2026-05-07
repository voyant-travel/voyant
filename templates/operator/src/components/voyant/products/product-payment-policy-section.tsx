"use client"

import type { PaymentPolicy } from "@voyantjs/finance"
import { PaymentPolicyForm, PaymentPolicyPreview } from "@voyantjs/finance-ui"
import {
  type ProductPaymentPolicy,
  type ProductRecord,
  useProductMutation,
} from "@voyantjs/products-react"
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@voyantjs/ui/components"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer payment policy</CardTitle>
        <CardDescription>
          When set, bookings of this product use these terms instead of the category / supplier /
          operator default. Inherit to fall back through the cascade.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <PaymentPolicyForm
          value={draft}
          onChange={setDraft}
          inheritable={true}
          currency={product.sellCurrency}
          disabled={update.isPending}
        />
        <div className="flex flex-col gap-3">
          <PaymentPolicyPreview policy={draft} currency={product.sellCurrency} />
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={update.isPending}
              onClick={() => {
                update.mutate(
                  {
                    id: product.id,
                    input: {
                      customerPaymentPolicy: (draft as ProductPaymentPolicy | null) ?? null,
                    },
                  },
                  {
                    onSuccess: () => {
                      toast.success("Customer payment policy saved")
                      onSuccess?.()
                    },
                    onError: (err) =>
                      toast.error(err instanceof Error ? err.message : "Failed to save policy"),
                  },
                )
              }}
            >
              {update.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save policy
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
