"use client"

import type { PaymentIntent } from "@voyantjs/flights/contract/types"
import { cn } from "@voyantjs/ui/lib/utils"
import { Banknote, Clock, CreditCard } from "lucide-react"
import type { ReactNode } from "react"

export interface FlightPaymentSelectorProps {
  value: PaymentIntent
  onChange: (next: PaymentIntent) => void
  /**
   * Which intents to show. Defaults to all three. Hide options the
   * configured connector doesn't declare (e.g. drop `hold` when
   * `flight/holds` capability isn't declared).
   */
  available?: Array<PaymentIntent["type"]>
}

interface IntentMeta {
  id: PaymentIntent["type"]
  title: string
  description: string
  icon: ReactNode
  build: () => PaymentIntent
}

const INTENTS: IntentMeta[] = [
  {
    id: "hold",
    title: "Hold seats — pay later",
    description:
      "Confirms the booking now and locks in the price for the connector's hold window. Tickets issue when payment lands.",
    icon: <Clock className="h-5 w-5" />,
    build: () => ({ type: "hold" }),
  },
  {
    id: "card",
    title: "Pay by card",
    description:
      "Tickets issue immediately. Card details handled outside this form by the connector's tokenization flow.",
    icon: <CreditCard className="h-5 w-5" />,
    build: () => ({ type: "card", token: "demo_card_token" }),
  },
  {
    id: "ticket_on_credit",
    title: "Ticket on agency credit",
    description:
      "Issue against the operator's IATA office credit line. Settles via BSP in the next reporting cycle.",
    icon: <Banknote className="h-5 w-5" />,
    build: () => ({ type: "ticket_on_credit" }),
  },
]

export function FlightPaymentSelector({ value, onChange, available }: FlightPaymentSelectorProps) {
  const visibleIntents = available ? INTENTS.filter((i) => available.includes(i.id)) : INTENTS

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <h3 className="mb-3 font-medium text-sm">Payment intent</h3>
      <p className="mb-4 text-xs text-muted-foreground">
        How the booking should be paid. Hold lets you confirm seats now and ticket later; card /
        on-credit issue tickets immediately.
      </p>
      <div role="radiogroup" className="flex flex-col gap-2">
        {visibleIntents.map((intent) => {
          const isSelected = value.type === intent.id
          return (
            // biome-ignore lint/a11y/useSemanticElements: deliberate custom radio (card-styled selectable button); switching to <input type="radio"> would require a visually-hidden input + label styling that doesn't compose with the card layout. aria-checked + role="radio" inside the role="radiogroup" exposes the right semantics to AT.
            <button
              key={intent.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange(intent.build())}
              className={cn(
                "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                isSelected ? "border-primary/40 bg-primary/5" : "border-border hover:bg-accent/30",
              )}
            >
              <div
                className={cn(
                  "shrink-0 rounded-md border p-2",
                  isSelected
                    ? "border-primary/30 bg-primary text-primary-foreground"
                    : "border-border bg-muted text-muted-foreground",
                )}
              >
                {intent.icon}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-medium">{intent.title}</span>
                <span className="text-xs text-muted-foreground">{intent.description}</span>
              </div>
              <div
                className={cn(
                  "mt-1 h-4 w-4 shrink-0 rounded-full border-2",
                  isSelected ? "border-primary bg-primary" : "border-border",
                )}
                aria-hidden
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}
