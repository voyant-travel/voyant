"use client"

import {
  type ComputedScheduleEntry,
  computePaymentSchedule,
  noDepositPolicy,
  type PaymentPolicy,
} from "@voyantjs/finance"
import { Input, Label, RadioGroup, RadioGroupItem, Switch } from "@voyantjs/ui/components"
import { cn } from "@voyantjs/ui/lib/utils"
import * as React from "react"

/**
 * Reusable payment-policy editor.
 *
 * Renders the deposit kind toggle (None / Percent / Fixed amount), the
 * conditional deposit value input, and the three day-window controls
 * (deposit gate, balance offset, balance grace). When `inheritable`
 * is true (the default for non-operator-default layers), an "Inherit
 * from parent" toggle is shown — flipping it on writes `null` and
 * disables the rest of the form.
 *
 * Controlled component: parent owns the value via `value` / `onChange`.
 * The bundled `<PaymentPolicyPreview />` reads the same value so you
 * can render the live preview alongside the form.
 */
export interface PaymentPolicyFormProps {
  /** Current value. `null` means "inherit from parent". */
  value: PaymentPolicy | null
  onChange: (next: PaymentPolicy | null) => void
  /**
   * When true, shows the "Inherit from parent" toggle. Operator-
   * default forms set this to false (no parent to inherit from).
   */
  inheritable?: boolean
  /** Currency used for the fixed-amount deposit input + the preview. */
  currency?: string
  /** Disabled by ancestor (e.g. while the mutation is in flight). */
  disabled?: boolean
  className?: string
}

const DEFAULT_POLICY: PaymentPolicy = {
  deposit: { kind: "percent", percent: 50 },
  minDaysBeforeDepartureForDeposit: 30,
  balanceDueDaysBeforeDeparture: 30,
  balanceDueMinDaysFromNow: 7,
}

export function PaymentPolicyForm({
  value,
  onChange,
  inheritable = true,
  currency = "EUR",
  disabled,
  className,
}: PaymentPolicyFormProps): React.ReactElement {
  const isInheriting = value === null
  const policy = value ?? noDepositPolicy

  const setPolicyField = <K extends keyof PaymentPolicy>(key: K, next: PaymentPolicy[K]) => {
    onChange({ ...(value ?? DEFAULT_POLICY), [key]: next })
  }

  return (
    <div className={cn("space-y-5", className)}>
      {inheritable ? (
        <div className="flex items-start gap-3 rounded-md border bg-muted/20 p-3">
          <Switch
            id="payment-policy-inherit"
            checked={isInheriting}
            onCheckedChange={(checked) => {
              if (checked) {
                onChange(null)
              } else {
                onChange(value ?? DEFAULT_POLICY)
              }
            }}
            disabled={disabled}
          />
          <div className="space-y-1">
            <Label htmlFor="payment-policy-inherit" className="text-sm font-medium">
              Inherit from parent
            </Label>
            <p className="text-muted-foreground text-xs">
              When on, this layer falls back to the next-broader policy (operator default, category,
              supplier, …). Switch off to set an explicit policy here.
            </p>
          </div>
        </div>
      ) : null}

      <fieldset disabled={disabled || isInheriting} className="space-y-5 disabled:opacity-60">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Deposit</Label>
          <RadioGroup
            value={policy.deposit.kind}
            onValueChange={(kind) => {
              if (kind === "none") {
                setPolicyField("deposit", { kind: "none" })
              } else if (kind === "percent") {
                setPolicyField("deposit", {
                  kind: "percent",
                  percent: policy.deposit.percent ?? 50,
                })
              } else if (kind === "fixed_cents") {
                setPolicyField("deposit", {
                  kind: "fixed_cents",
                  amountCents: policy.deposit.amountCents ?? 10_000,
                })
              }
            }}
            className="grid grid-cols-1 gap-2 md:grid-cols-3"
          >
            <DepositKindOption
              value="none"
              label="None"
              hint="Customer pays the full amount up-front."
              checked={policy.deposit.kind === "none"}
            />
            <DepositKindOption
              value="percent"
              label="Percent of total"
              hint="e.g. 50% deposit at booking."
              checked={policy.deposit.kind === "percent"}
            />
            <DepositKindOption
              value="fixed_cents"
              label="Fixed amount"
              hint="A flat per-booking amount."
              checked={policy.deposit.kind === "fixed_cents"}
            />
          </RadioGroup>

          {policy.deposit.kind === "percent" ? (
            <div className="grid grid-cols-1 gap-3 pt-2 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="payment-policy-percent">Deposit percent</Label>
                <Input
                  id="payment-policy-percent"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={policy.deposit.percent ?? 50}
                  onChange={(e) =>
                    setPolicyField("deposit", {
                      kind: "percent",
                      percent: Number(e.target.value),
                    })
                  }
                />
                <p className="text-muted-foreground text-xs">0–100. Whole numbers recommended.</p>
              </div>
            </div>
          ) : null}

          {policy.deposit.kind === "fixed_cents" ? (
            <div className="grid grid-cols-1 gap-3 pt-2 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="payment-policy-fixed">Deposit amount ({currency})</Label>
                <Input
                  id="payment-policy-fixed"
                  type="number"
                  min={0}
                  step={0.01}
                  value={(policy.deposit.amountCents ?? 0) / 100}
                  onChange={(e) =>
                    setPolicyField("deposit", {
                      kind: "fixed_cents",
                      amountCents: Math.round(Number(e.target.value) * 100),
                    })
                  }
                />
                <p className="text-muted-foreground text-xs">
                  Capped at the booking total when the booking is smaller than this amount.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="payment-policy-min-days">Minimum days before departure</Label>
            <Input
              id="payment-policy-min-days"
              type="number"
              min={0}
              step={1}
              value={policy.minDaysBeforeDepartureForDeposit}
              onChange={(e) =>
                setPolicyField("minDaysBeforeDepartureForDeposit", Number(e.target.value))
              }
            />
            <p className="text-muted-foreground text-xs">
              If departure is closer than this, the booking requires the full amount up-front.
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="payment-policy-balance-days">Balance due days before departure</Label>
            <Input
              id="payment-policy-balance-days"
              type="number"
              min={0}
              step={1}
              value={policy.balanceDueDaysBeforeDeparture}
              onChange={(e) =>
                setPolicyField("balanceDueDaysBeforeDeparture", Number(e.target.value))
              }
            />
            <p className="text-muted-foreground text-xs">When the balance is due.</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="payment-policy-grace">Balance grace days from now</Label>
            <Input
              id="payment-policy-grace"
              type="number"
              min={0}
              step={1}
              value={policy.balanceDueMinDaysFromNow}
              onChange={(e) => setPolicyField("balanceDueMinDaysFromNow", Number(e.target.value))}
            />
            <p className="text-muted-foreground text-xs">
              Floor on the balance due date so the customer always gets at least this long to pay
              it.
            </p>
          </div>
        </div>
      </fieldset>
    </div>
  )
}

function DepositKindOption({
  value,
  label,
  hint,
  checked,
}: {
  value: string
  label: string
  hint: string
  checked: boolean
}) {
  return (
    <Label
      htmlFor={`payment-policy-deposit-${value}`}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-md border p-3",
        checked ? "border-primary bg-primary/5" : "bg-background",
      )}
    >
      <RadioGroupItem id={`payment-policy-deposit-${value}`} value={value} className="mt-1" />
      <div className="space-y-1">
        <div className="text-sm font-medium">{label}</div>
        <p className="text-muted-foreground text-xs">{hint}</p>
      </div>
    </Label>
  )
}

/**
 * Live preview of what the policy will produce on a sample booking.
 * Pair with `<PaymentPolicyForm />` so the operator sees the
 * deposit + balance amounts shift in real time as they tweak the
 * fields.
 */
export interface PaymentPolicyPreviewProps {
  policy: PaymentPolicy | null
  currency?: string
  /** Total used for the preview math. Default 1,000.00 in major units. */
  sampleTotalCents?: number
  /** Days before departure to use for the preview. Default 60. */
  sampleDaysBeforeDeparture?: number
  className?: string
}

export function PaymentPolicyPreview({
  policy,
  currency = "EUR",
  sampleTotalCents = 100_000,
  sampleDaysBeforeDeparture = 60,
  className,
}: PaymentPolicyPreviewProps): React.ReactElement {
  const today = React.useMemo(() => new Date(), [])
  const departureDate = React.useMemo(() => {
    const d = new Date(today.getTime() + sampleDaysBeforeDeparture * 24 * 60 * 60 * 1000)
    return d.toISOString().slice(0, 10)
  }, [today, sampleDaysBeforeDeparture])

  const schedule = React.useMemo(
    () =>
      policy
        ? computePaymentSchedule(
            { totalCents: sampleTotalCents, currency, departureDate, today },
            policy,
          )
        : [],
    [sampleTotalCents, currency, departureDate, policy, today],
  )

  if (!policy) {
    return (
      <div
        className={cn(
          "rounded-md border border-dashed bg-muted/20 p-3 text-muted-foreground text-xs",
          className,
        )}
      >
        Inheriting from parent — no preview at this layer.
      </div>
    )
  }

  return (
    <div className={cn("space-y-2 rounded-md border bg-muted/20 p-3 text-sm", className)}>
      <div className="text-muted-foreground text-xs">
        Sample: {formatMoney(sampleTotalCents, currency)} booking, departure in{" "}
        {sampleDaysBeforeDeparture} days
      </div>
      <ul className="space-y-1">
        {schedule.map((entry) => (
          <ScheduleRow
            key={`${entry.scheduleType}-${entry.dueDate}`}
            entry={entry}
            currency={currency}
          />
        ))}
      </ul>
    </div>
  )
}

function ScheduleRow({ entry, currency }: { entry: ComputedScheduleEntry; currency: string }) {
  const label =
    entry.scheduleType === "deposit"
      ? "Deposit"
      : entry.scheduleType === "balance"
        ? "Balance"
        : "Full payment"
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="font-medium">{label}</span>
      <span className="font-mono text-xs">{formatMoney(entry.amountCents, currency)}</span>
      <span className="text-muted-foreground text-xs">due {entry.dueDate}</span>
    </li>
  )
}

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100)
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`
  }
}
