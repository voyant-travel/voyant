import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Textarea,
} from "@voyantjs/ui/components"
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@voyantjs/ui/components/field"
import { Loader2, Save } from "lucide-react"

import { type FormState, paymentMethods } from "./storefront-settings-form.js"

type SetField = <K extends keyof FormState>(key: K, value: FormState[K]) => void

export function PaymentSection({ form, setField }: { form: FormState; setField: SetField }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment defaults</CardTitle>
        <CardDescription>Default payment methods, schedules, and bank details.</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <FieldSet>
            <FieldLegend>Payment methods</FieldLegend>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {paymentMethods.map((method) => (
                <Field key={method.code} orientation="horizontal">
                  <Checkbox
                    id={`storefront-payment-${method.code}`}
                    checked={form.enabledMethods[method.code]}
                    onCheckedChange={(checked) =>
                      setField("enabledMethods", {
                        ...form.enabledMethods,
                        [method.code]: checked === true,
                      })
                    }
                  />
                  <FieldLabel htmlFor={`storefront-payment-${method.code}`}>
                    {method.label}
                  </FieldLabel>
                </Field>
              ))}
            </div>
          </FieldSet>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="storefront-default-method">Default method</FieldLabel>
              <select
                id="storefront-default-method"
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={form.defaultMethod}
                onChange={(event) =>
                  setField("defaultMethod", event.target.value as FormState["defaultMethod"])
                }
              >
                <option value="none">None</option>
                {paymentMethods.map((method) => (
                  <option key={method.code} value={method.code}>
                    {method.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="storefront-payment-structure">Payment structure</FieldLabel>
              <select
                id="storefront-payment-structure"
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={form.paymentStructure}
                onChange={(event) =>
                  setField("paymentStructure", event.target.value as FormState["paymentStructure"])
                }
              >
                <option value="full">Full payment</option>
                <option value="split">Deposit + balance</option>
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="storefront-deposit-percent">Deposit percent</FieldLabel>
              <Input
                id="storefront-deposit-percent"
                type="number"
                min={0}
                max={100}
                value={form.depositPercent}
                onChange={(event) => setField("depositPercent", event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="storefront-balance-due">Balance due days</FieldLabel>
              <Input
                id="storefront-balance-due"
                type="number"
                min={0}
                value={form.balanceDueDaysBeforeDeparture}
                onChange={(event) => setField("balanceDueDaysBeforeDeparture", event.target.value)}
              />
            </Field>
          </div>

          <FieldSet>
            <FieldLegend>Bank transfer details</FieldLegend>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="storefront-bank-provider">Provider</FieldLabel>
                <Input
                  id="storefront-bank-provider"
                  value={form.bankProvider}
                  onChange={(event) => setField("bankProvider", event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="storefront-bank-currency">Currency</FieldLabel>
                <Input
                  id="storefront-bank-currency"
                  value={form.bankCurrency}
                  onChange={(event) => setField("bankCurrency", event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="storefront-account-holder">Account holder</FieldLabel>
                <Input
                  id="storefront-account-holder"
                  value={form.accountHolder}
                  onChange={(event) => setField("accountHolder", event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="storefront-bank-name">Bank name</FieldLabel>
                <Input
                  id="storefront-bank-name"
                  value={form.bankName}
                  onChange={(event) => setField("bankName", event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="storefront-iban">IBAN or account number</FieldLabel>
                <Input
                  id="storefront-iban"
                  value={form.iban}
                  onChange={(event) => setField("iban", event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="storefront-bic">BIC or routing code</FieldLabel>
                <Input
                  id="storefront-bic"
                  value={form.bic}
                  onChange={(event) => setField("bic", event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="storefront-bank-due-days">Due days</FieldLabel>
                <Input
                  id="storefront-bank-due-days"
                  type="number"
                  min={0}
                  value={form.bankTransferDueDays}
                  onChange={(event) => setField("bankTransferDueDays", event.target.value)}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="storefront-payment-reference">Payment reference</FieldLabel>
              <Input
                id="storefront-payment-reference"
                value={form.paymentReference}
                onChange={(event) => setField("paymentReference", event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="storefront-bank-instructions">Instructions</FieldLabel>
              <Textarea
                id="storefront-bank-instructions"
                value={form.bankInstructions}
                onChange={(event) => setField("bankInstructions", event.target.value)}
              />
            </Field>
          </FieldSet>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}

export function StorefrontSettingsSaveButton({
  isSaving,
  save,
}: {
  isSaving: boolean
  save: () => void
}) {
  return (
    <div className="flex justify-end">
      <Button type="button" onClick={save} disabled={isSaving}>
        {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        Save settings
      </Button>
    </div>
  )
}
