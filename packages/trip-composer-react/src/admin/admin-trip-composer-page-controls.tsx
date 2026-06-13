"use client"

import { formatMessage } from "@voyantjs/i18n"
import { Button } from "@voyantjs/ui/components/button"
import { Checkbox } from "@voyantjs/ui/components/checkbox"
import { Label } from "@voyantjs/ui/components/label"
import { Textarea } from "@voyantjs/ui/components/textarea"
import { AlertTriangle, Loader2 } from "lucide-react"
import type { AdminComposerMessages } from "./admin-trip-composer-page-model.js"
import { Field, Section } from "./admin-trip-composer-panels.js"

export interface CancellationPreview {
  refund: number
  penalty: number
  staffActionRequired: boolean
  warnings: string[]
}

export function CancellationPreviewSection({
  messages,
  selectedCount,
  cancellationReason,
  onCancellationReasonChange,
  cancellationPreview,
  paymentCurrency,
  isBusy,
  hasEnvelope,
  isPending,
  onPreview,
  onClearSelection,
}: {
  messages: AdminComposerMessages
  selectedCount: number
  cancellationReason: string
  onCancellationReasonChange(value: string): void
  cancellationPreview: CancellationPreview | null
  paymentCurrency: string
  isBusy: boolean
  hasEnvelope: boolean
  isPending: boolean
  onPreview(): void
  onClearSelection(): void
}) {
  const t = messages.cancellation
  return (
    <Section
      title={formatMessage(selectedCount === 1 ? t.sectionTitleSingular : t.sectionTitlePlural, {
        count: selectedCount,
      })}
      description={t.sectionDescription}
      action={
        <Button variant="ghost" size="sm" onClick={onClearSelection}>
          {t.clearSelection}
        </Button>
      }
    >
      <Field label={t.reasonLabel}>
        <Textarea
          rows={2}
          value={cancellationReason}
          onChange={(event) => onCancellationReasonChange(event.target.value)}
        />
      </Field>
      <Button variant="outline" onClick={onPreview} disabled={isBusy || !hasEnvelope}>
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <AlertTriangle className="size-4" />
        )}
        {t.previewButton}
      </Button>
      {cancellationPreview ? (
        <div className="space-y-1 rounded-md border bg-muted/30 p-3 text-sm">
          <CancellationRow
            label={t.estimatedRefund}
            value={formatMoney(cancellationPreview.refund, paymentCurrency)}
          />
          <CancellationRow
            label={t.estimatedPenalty}
            value={formatMoney(cancellationPreview.penalty, paymentCurrency)}
          />
          <CancellationRow
            label={t.staffAction}
            value={
              cancellationPreview.staffActionRequired
                ? t.staffActionRequired
                : t.staffActionNotRequired
            }
          />
          {cancellationPreview.warnings.length > 0 ? (
            <p className="text-amber-600 text-xs">{cancellationPreview.warnings.join(", ")}</p>
          ) : null}
        </div>
      ) : null}
    </Section>
  )
}

export function CheckboxRow({
  id,
  checked,
  onCheckedChange,
  label,
  hint,
}: {
  id: string
  checked: boolean
  onCheckedChange: (value: boolean) => void
  label: string
  hint?: string
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="mt-0.5"
      />
      <div className="flex flex-col gap-1">
        <Label htmlFor={id} className="cursor-pointer text-sm">
          {label}
        </Label>
        {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      </div>
    </div>
  )
}

function CancellationRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  )
}

function formatMoney(amountCents: number | null | undefined, currency: string) {
  if (amountCents == null) return "-"
  return (amountCents / 100).toLocaleString(undefined, { style: "currency", currency })
}
