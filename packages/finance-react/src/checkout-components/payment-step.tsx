"use client"

import { formatMessage } from "@voyant-travel/i18n"
import { Input } from "@voyant-travel/ui/components/input"
import { Label } from "@voyant-travel/ui/components/label"
import { RadioGroup, RadioGroupItem } from "@voyant-travel/ui/components/radio-group"
import { cn } from "@voyant-travel/ui/lib/utils"
import { Banknote, CreditCard, Wallet } from "lucide-react"
import { type ReactNode, useState } from "react"
import { useCheckoutUiMessagesOrDefault } from "../checkout-i18n/provider.js"
import type {
  PaymentStepExtraOption as CheckoutPaymentStepExtraOption,
  PaymentChoice,
  PaymentStepCapabilities,
  SavedPaymentAccount,
} from "../checkout-types.js"

/**
 * UI-side extension of the `PaymentStepExtraOption` from finance-react —
 * adds an optional `icon` slot since the icon is a presentation concern.
 */
export interface PaymentStepUiExtraOption extends CheckoutPaymentStepExtraOption {
  icon?: ReactNode
}

export interface PaymentStepProps {
  value: PaymentChoice | null
  onChange: (next: PaymentChoice | null) => void

  /**
   * What the active processor / template actually offers. Each `false`
   * value hides its section. Honest — no invented capability strings.
   */
  capabilities: PaymentStepCapabilities

  /** Saved methods on file — surfaced when `capabilities.chargeSavedCard` is true. */
  savedMethods?: SavedPaymentAccount[]
  loadingSavedMethods?: boolean

  /**
   * Vertical-specific always-available options. Rendered after the
   * capability-gated sections, before the universal Hold option.
   */
  extraOptions?: ReadonlyArray<PaymentStepUiExtraOption>

  /** Hide the universal "Hold — pay later" option (some verticals don't support it). */
  hideHoldOption?: boolean
}

/**
 * Admin-side payment picker. Renders the sections the parent has wired:
 *
 *   - Saved cards on file        ← capabilities.chargeSavedCard
 *   - Charge a new card now      ← capabilities.newCard
 *   - Vertical-specific extras   ← always rendered (e.g. "Issue on credit")
 *   - Hold — generate payment link  ← always rendered (unless hideHoldOption)
 *
 * The customer's card-vs-bank-transfer decision happens on the public
 * `/pay/:sessionId` landing page, not here. That keeps the admin UI to
 * three real choices: charge now, vertical action, or hold + share link.
 */
export function PaymentStep({
  value,
  onChange,
  capabilities,
  savedMethods,
  loadingSavedMethods,
  extraOptions,
  hideHoldOption,
}: PaymentStepProps) {
  const messages = useCheckoutUiMessagesOrDefault().paymentStep
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-semibold text-base">{messages.title}</h2>
        <p className="text-muted-foreground text-sm">{messages.description}</p>
      </div>

      {capabilities.chargeSavedCard && (
        <SavedMethodsSection
          loading={loadingSavedMethods}
          methods={savedMethods ?? []}
          selectedId={value?.type === "saved_method" ? value.method.id : null}
          onSelect={(method) => onChange({ type: "saved_method", method })}
        />
      )}

      <AltMethodsSection
        value={value}
        onChange={onChange}
        showNewCard={!!capabilities.newCard}
        extraOptions={extraOptions ?? []}
        hideHoldOption={hideHoldOption}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function SavedMethodsSection({
  loading,
  methods,
  selectedId,
  onSelect,
}: {
  loading?: boolean
  methods: SavedPaymentAccount[]
  selectedId: string | null
  onSelect: (method: SavedPaymentAccount) => void
}) {
  const messages = useCheckoutUiMessagesOrDefault().paymentStep.savedMethods
  return (
    <section className="rounded-md border bg-card p-6 shadow-sm">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="font-medium text-sm">{messages.title}</h3>
        {methods.length > 0 && (
          <span className="text-muted-foreground text-xs">
            {formatMessage(messages.countOnFile, { count: methods.length })}
          </span>
        )}
      </header>
      {loading ? (
        <div className="h-16 animate-pulse rounded-md bg-muted/40" />
      ) : methods.length === 0 ? (
        <div className="rounded-md border border-dashed p-4 text-center text-muted-foreground text-xs">
          {messages.empty}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {methods.map((m) => {
            const selected = selectedId === m.id
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onSelect(m)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md border bg-background p-3 text-left transition-colors",
                    selected
                      ? "border-primary ring-2 ring-primary/20"
                      : "hover:border-primary/40 hover:bg-accent/30",
                  )}
                >
                  <BrandTile brand={m.brand} />
                  <div className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="font-medium text-sm">
                      {m.label}
                      {m.last4 && (
                        <>
                          {" ···· "}
                          <span className="font-mono">{m.last4}</span>
                        </>
                      )}
                      {m.isDefault && (
                        <span className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 font-medium text-[9px] text-primary uppercase tracking-wider">
                          {messages.defaultBadge}
                        </span>
                      )}
                    </span>
                    {m.expiryMonth && m.expiryYear && (
                      <span className="text-muted-foreground text-xs">
                        {formatMessage(messages.expires, {
                          month: String(m.expiryMonth).padStart(2, "0"),
                          year: m.expiryYear,
                        })}
                      </span>
                    )}
                  </div>
                  {selected && (
                    <span className="font-medium text-primary text-xs">{messages.selected}</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

type AltModeId = "new_card" | "hold" | `extra:${string}`

function AltMethodsSection({
  value,
  onChange,
  showNewCard,
  extraOptions,
  hideHoldOption,
}: {
  value: PaymentChoice | null
  onChange: (next: PaymentChoice | null) => void
  showNewCard: boolean
  extraOptions: ReadonlyArray<PaymentStepUiExtraOption>
  hideHoldOption?: boolean
}) {
  const messages = useCheckoutUiMessagesOrDefault().paymentStep.otherOptions
  const [newCardName, setNewCardName] = useState("")
  const [newCardNumber, setNewCardNumber] = useState("")
  const [newCardExp, setNewCardExp] = useState("")

  const activeId: AltModeId | null = (() => {
    if (value == null) return null
    if (value.type === "saved_method") return null
    if (value.type === "new_card") return "new_card"
    if (value.type === "hold") return "hold"
    if (value.type === "extra") return `extra:${value.optionId}`
    return null
  })()

  const setAlt = (id: AltModeId) => {
    if (id === "hold") {
      onChange({ type: "hold" })
    } else if (id === "new_card") {
      onChange({
        type: "new_card",
        cardToken: tokenizeNewCard(newCardNumber),
        ...(newCardName ? { cardholderName: newCardName } : {}),
        ...(newCardExp ? { expiry: newCardExp } : {}),
      })
    } else if (id.startsWith("extra:")) {
      onChange({ type: "extra", optionId: id.slice("extra:".length) })
    }
  }

  return (
    <section className="rounded-md border bg-card p-6 shadow-sm">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="font-medium text-sm">{messages.title}</h3>
      </header>
      <RadioGroup
        value={activeId ?? "__none"}
        onValueChange={(v: string | null) => {
          if (!v) return
          if (v === "new_card" || v === "hold" || v.startsWith("extra:")) {
            setAlt(v as AltModeId)
          }
        }}
        className="flex flex-col gap-2"
      >
        {showNewCard && (
          <AltRow
            id="new_card"
            icon={<CreditCard className="h-4 w-4 text-muted-foreground" />}
            title={messages.newCard.title}
            body={messages.newCard.body}
            active={activeId === "new_card"}
          >
            {activeId === "new_card" && (
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                <Field label={messages.newCard.cardholderName}>
                  <Input
                    value={newCardName}
                    onChange={(e) => {
                      setNewCardName(e.target.value)
                      if (value?.type === "new_card") {
                        onChange({ ...value, cardholderName: e.target.value })
                      }
                    }}
                  />
                </Field>
                <Field label={messages.newCard.cardNumber}>
                  <Input
                    inputMode="numeric"
                    placeholder={messages.newCard.cardNumberPlaceholder}
                    value={newCardNumber}
                    onChange={(e) => {
                      setNewCardNumber(e.target.value)
                      if (value?.type === "new_card") {
                        onChange({ ...value, cardToken: tokenizeNewCard(e.target.value) })
                      }
                    }}
                  />
                </Field>
                <Field label={messages.newCard.expiry}>
                  <Input
                    value={newCardExp}
                    onChange={(e) => {
                      setNewCardExp(e.target.value)
                      if (value?.type === "new_card") {
                        onChange({ ...value, expiry: e.target.value })
                      }
                    }}
                    placeholder={messages.newCard.expiryPlaceholder}
                  />
                </Field>
              </div>
            )}
          </AltRow>
        )}

        {extraOptions.map((opt) => (
          <AltRow
            key={opt.id}
            id={`extra:${opt.id}`}
            icon={opt.icon}
            title={opt.label}
            body={opt.description}
            active={activeId === `extra:${opt.id}`}
          />
        ))}

        {!hideHoldOption && (
          <AltRow
            id="hold"
            icon={<Wallet className="h-4 w-4 text-muted-foreground" />}
            title={messages.hold.title}
            body={messages.hold.body}
            active={activeId === "hold"}
          />
        )}
      </RadioGroup>

      {showNewCard && (
        <p className="mt-4 flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <Banknote className="mt-0.5 h-3 w-3" />
          {messages.cardSecurityNote}
        </p>
      )}
    </section>
  )
}

function AltRow({
  id,
  icon,
  title,
  body,
  active,
  children,
}: {
  id: string
  icon: ReactNode
  title: string
  body: string
  active: boolean
  children?: ReactNode
}) {
  const inputId = `payment-step-${id}`
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-md border bg-background p-3 transition-colors",
        active ? "border-primary bg-primary/5" : "hover:border-primary/40",
      )}
    >
      <RadioGroupItem id={inputId} value={id} className="mt-0.5" />
      <label htmlFor={inputId} className="flex min-w-0 flex-1 cursor-pointer flex-col gap-1">
        <span className="flex items-center gap-2 font-medium text-sm">
          {icon}
          {title}
        </span>
        <span className="text-muted-foreground text-xs">{body}</span>
        {children}
      </label>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

function BrandTile({ brand }: { brand: string | null }) {
  const messages = useCheckoutUiMessagesOrDefault().paymentStep.otherOptions
  return (
    <span className="flex h-9 w-12 shrink-0 items-center justify-center rounded-md border bg-muted/30 font-mono text-[10px] uppercase tracking-wider">
      {(brand ?? messages.brandFallback).slice(0, 4)}
    </span>
  )
}

function tokenizeNewCard(number: string): string {
  // Demo "tokenization" — in production the processor's hosted form
  // returns an opaque token; we never see the PAN here.
  const last4 = number.replace(/\D/g, "").slice(-4) || "0000"
  return `tok_demo_new_${last4}`
}
