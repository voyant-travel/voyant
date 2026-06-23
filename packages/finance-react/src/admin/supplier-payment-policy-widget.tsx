"use client"

import type { SupplierCustomerPaymentPolicy } from "@voyant-travel/distribution-react/suppliers"
import type { SupplierDetailHostSlotContext } from "@voyant-travel/distribution-react/suppliers/admin"
import type { PaymentPolicy } from "@voyant-travel/finance/payment-policy"
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@voyant-travel/ui/components"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { PaymentPolicyForm, PaymentPolicyPreview } from "../components/payment-policy-form.js"
import { useFinanceUiMessagesOrDefault } from "../i18n/index.js"

/**
 * Props of the supplier payment-policy widget: exactly the slot context the
 * supplier detail host hands to `supplier.details.payment-policy` widget
 * contributions (see `supplierDetailPaymentPolicySlot` in
 * `@voyant-travel/distribution-react/suppliers/admin`).
 */
export type SupplierPaymentPolicyWidgetProps = SupplierDetailHostSlotContext

/**
 * Finance-owned customer-payment-policy card for the supplier detail page,
 * delivered as a widget contribution on `supplier.details.payment-policy`
 * (packaged-admin RFC §4.7 cycle resolution: this package depends on
 * `@voyant-travel/distribution-react/suppliers/ui`, so the supplier host cannot import the
 * payment-policy form/preview directly — the contribution travels the other
 * way through the admin extension registry).
 */
export function SupplierPaymentPolicyWidget({
  supplier,
  updateSupplier,
  isUpdating,
}: SupplierPaymentPolicyWidgetProps) {
  const messages = useFinanceUiMessagesOrDefault().paymentPolicy.supplierCard
  const persistedPolicy = (supplier.customerPaymentPolicy as PaymentPolicy | null) ?? null
  const [policyDraft, setPolicyDraft] = useState<PaymentPolicy | null>(persistedPolicy)

  useEffect(() => {
    setPolicyDraft(persistedPolicy)
  }, [persistedPolicy])

  return (
    <Card>
      <CardHeader>
        <CardTitle>{messages.title}</CardTitle>
        <CardDescription>{messages.description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        {supplier.defaultCurrency ? (
          <>
            <PaymentPolicyForm
              value={policyDraft}
              onChange={setPolicyDraft}
              inheritable={true}
              currency={supplier.defaultCurrency}
              disabled={isUpdating}
            />
            <div className="flex flex-col gap-3">
              <PaymentPolicyPreview policy={policyDraft} currency={supplier.defaultCurrency} />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  disabled={isUpdating}
                  onClick={() => {
                    void updateSupplier({
                      customerPaymentPolicy:
                        (policyDraft as SupplierCustomerPaymentPolicy | null) ?? null,
                    })
                      .then(() => toast.success(messages.savedToast))
                      .catch((error: unknown) =>
                        toast.error(error instanceof Error ? error.message : messages.saveFailed),
                      )
                  }}
                >
                  {isUpdating ? <Loader2 className="animate-spin" /> : null}
                  {messages.save}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground lg:col-span-2">{messages.missingCurrency}</p>
        )}
      </CardContent>
    </Card>
  )
}
