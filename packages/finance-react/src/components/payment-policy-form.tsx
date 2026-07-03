"use client"

import {
  type ComputedScheduleEntry,
  computePaymentSchedule,
  noDepositPolicy,
  normalizePaymentPolicy,
  type PaymentPolicy,
} from "@voyant-travel/finance/payment-policy"
import { formatMessage } from "@voyant-travel/i18n"
import {
  Button,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@voyant-travel/ui/components"
import { cn } from "@voyant-travel/ui/lib/utils"
import { HelpCircle } from "lucide-react"
import * as React from "react"

import { useFinanceUiI18nOrDefault } from "../i18n/index.js"

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

const depositKinds = ["none", "percent", "fixed_cents"] as const
type DepositKind = (typeof depositKinds)[number]

export function PaymentPolicyForm({
  value,
  onChange,
  inheritable = true,
  currency = "EUR",
  disabled,
  className,
}: PaymentPolicyFormProps): React.ReactElement {
  const messages = useFinanceUiI18nOrDefault().messages.paymentPolicy.form
  const normalizedValue = React.useMemo(() => normalizePaymentPolicy(value), [value])
  const isInheriting = inheritable && normalizedValue === null
  const policy = normalizedValue ?? noDepositPolicy

  const setPolicyField = <K extends keyof PaymentPolicy>(key: K, next: PaymentPolicy[K]) => {
    onChange({ ...(normalizedValue ?? DEFAULT_POLICY), [key]: next })
  }
  const setDepositKind = (kind: DepositKind) => {
    if (kind === "none") {
      setPolicyField("deposit", { kind: "none" })
      return
    }
    if (kind === "percent") {
      setPolicyField("deposit", {
        kind: "percent",
        percent: policy.deposit.kind === "percent" ? (policy.deposit.percent ?? 50) : 50,
      })
      return
    }
    setPolicyField("deposit", {
      kind: "fixed_cents",
      amountCents:
        policy.deposit.kind === "fixed_cents" ? (policy.deposit.amountCents ?? 10_000) : 10_000,
    })
  }
  const depositHint = messages.depositHints[policy.deposit.kind]

  return (
    <TooltipProvider>
      <div className={cn("space-y-4", className)}>
        {inheritable ? (
          <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <Label htmlFor="payment-policy-inherit" className="text-sm font-medium">
                {messages.inherit.label}
              </Label>
              <InfoTooltip label={messages.inherit.tooltipLabel}>
                {messages.inherit.help}
              </InfoTooltip>
            </div>
            <Switch
              id="payment-policy-inherit"
              checked={isInheriting}
              onCheckedChange={(checked) =>
                onChange(checked ? null : (normalizedValue ?? DEFAULT_POLICY))
              }
              disabled={disabled}
            />
          </div>
        ) : null}

        <fieldset disabled={disabled || isInheriting} className="space-y-4 disabled:opacity-60">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(13rem,16rem)_minmax(13rem,1fr)]">
            <div className="space-y-1.5">
              <Label htmlFor="payment-policy-deposit-kind">{messages.depositKind.label}</Label>
              <Select
                value={policy.deposit.kind}
                onValueChange={(kind) => setDepositKind(kind as DepositKind)}
              >
                <SelectTrigger id="payment-policy-deposit-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {depositKinds.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {messages.depositKind.options[kind]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {policy.deposit.kind === "percent" ? (
              <div className="space-y-1.5">
                <Label htmlFor="payment-policy-percent">{messages.depositValue.percentLabel}</Label>
                <InputGroup>
                  <InputGroupInput
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
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>%</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
                <p className="text-muted-foreground text-xs">{depositHint}</p>
              </div>
            ) : null}

            {policy.deposit.kind === "fixed_cents" ? (
              <div className="space-y-1.5">
                <Label htmlFor="payment-policy-fixed">{messages.depositValue.fixedLabel}</Label>
                <InputGroup>
                  <InputGroupInput
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
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>{currency}</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
                <p className="text-muted-foreground text-xs">{depositHint}</p>
              </div>
            ) : null}

            {policy.deposit.kind === "none" ? (
              <div className="flex items-end pb-2">
                <p className="text-muted-foreground text-xs">{depositHint}</p>
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <DaysInput
              id="payment-policy-min-days"
              label={messages.days.minDaysLabel}
              help={messages.days.minDaysHelp}
              tooltipLabel={messages.days.tooltipLabel}
              value={policy.minDaysBeforeDepartureForDeposit}
              suffix={messages.days.suffix}
              onChange={(next) => setPolicyField("minDaysBeforeDepartureForDeposit", next)}
            />
            <DaysInput
              id="payment-policy-balance-days"
              label={messages.days.balanceDaysLabel}
              help={messages.days.balanceDaysHelp}
              tooltipLabel={messages.days.tooltipLabel}
              value={policy.balanceDueDaysBeforeDeparture}
              suffix={messages.days.suffix}
              onChange={(next) => setPolicyField("balanceDueDaysBeforeDeparture", next)}
            />
            <DaysInput
              id="payment-policy-grace"
              label={messages.days.graceDaysLabel}
              help={messages.days.graceDaysHelp}
              tooltipLabel={messages.days.tooltipLabel}
              value={policy.balanceDueMinDaysFromNow}
              suffix={messages.days.suffix}
              onChange={(next) => setPolicyField("balanceDueMinDaysFromNow", next)}
            />
          </div>
        </fieldset>
      </div>
    </TooltipProvider>
  )
}

function DaysInput({
  id,
  label,
  help,
  tooltipLabel,
  value,
  suffix,
  onChange,
}: {
  id: string
  label: string
  help: string
  tooltipLabel: string
  value: number
  suffix: string
  onChange: (next: number) => void
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id}>{label}</Label>
        <InfoTooltip label={tooltipLabel}>{help}</InfoTooltip>
      </div>
      <InputGroup>
        <InputGroupInput
          id={id}
          type="number"
          min={0}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupText>{suffix}</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
    </div>
  )
}

function InfoTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button type="button" variant="ghost" size="icon" className="size-5" />}
      >
        <HelpCircle className="size-3.5 text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </TooltipTrigger>
      <TooltipContent>{children}</TooltipContent>
    </Tooltip>
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
  const i18n = useFinanceUiI18nOrDefault()
  const messages = i18n.messages.paymentPolicy.preview
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
          "self-start rounded-md border border-dashed bg-muted/20 p-3 text-muted-foreground text-xs",
          className,
        )}
      >
        {messages.inheriting}
      </div>
    )
  }

  return (
    <div
      className={cn("self-start space-y-2 rounded-md border bg-muted/20 p-3 text-sm", className)}
    >
      <div className="text-muted-foreground text-xs">
        {formatMessage(messages.sample, {
          amount: i18n.formatCurrency(sampleTotalCents / 100, currency),
          days: i18n.formatNumber(sampleDaysBeforeDeparture),
        })}
      </div>
      <ul className="space-y-1">
        {schedule.map((entry) => (
          <ScheduleRow
            key={`${entry.scheduleType}-${entry.dueDate}`}
            entry={entry}
            currency={currency}
            labels={messages.scheduleTypes}
            dueLabel={messages.due}
            formatCurrency={i18n.formatCurrency}
            formatDate={i18n.formatDate}
          />
        ))}
      </ul>
    </div>
  )
}

function ScheduleRow({
  entry,
  currency,
  labels,
  dueLabel,
  formatCurrency,
  formatDate,
}: {
  entry: ComputedScheduleEntry
  currency: string
  labels: Record<ComputedScheduleEntry["scheduleType"], string>
  dueLabel: string
  formatCurrency: (value: number, currency: string) => string
  formatDate: (value: string | number | Date) => string
}) {
  const label =
    entry.scheduleType === "deposit"
      ? labels.deposit
      : entry.scheduleType === "balance"
        ? labels.balance
        : labels.full
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="font-medium">{label}</span>
      <span className="font-mono text-xs">{formatCurrency(entry.amountCents / 100, currency)}</span>
      <span className="text-muted-foreground text-xs">
        {formatMessage(dueLabel, { date: formatDate(entry.dueDate) })}
      </span>
    </li>
  )
}
