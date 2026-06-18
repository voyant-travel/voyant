"use client"

import { Input } from "@voyant-travel/ui/components/input"
import { Label } from "@voyant-travel/ui/components/label"
import { Mail, Phone } from "lucide-react"
import { flightsUiEn } from "../i18n/en.js"
import { useFlightsUiMessagesOrDefault } from "../i18n/index.js"

export interface FlightContactValue {
  email?: string
  phone?: string
}

export interface FlightContactFormProps {
  value: FlightContactValue
  onChange: (next: FlightContactValue) => void
}

/**
 * Booking contact details — used by the connector to send confirmation +
 * any operational disruption notices. Email is required by most providers;
 * phone is recommended but optional.
 */
export function FlightContactForm({ value, onChange }: FlightContactFormProps) {
  const messages = useFlightsUiMessagesOrDefault().flightContactForm
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <h3 className="mb-3 font-medium text-sm">{messages.title}</h3>
      <p className="mb-4 text-xs text-muted-foreground">{messages.description}</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {messages.email} <span className="ml-0.5 text-destructive">*</span>
          </Label>
          <div className="relative">
            <Mail className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
            <Input
              type="email"
              autoComplete="email"
              value={value.email ?? ""}
              onChange={(e) => onChange({ ...value, email: e.target.value })}
              placeholder={messages.emailPlaceholder}
              className="pl-9"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {messages.phone}
          </Label>
          <div className="relative">
            <Phone className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
            <Input
              type="tel"
              autoComplete="tel"
              value={value.phone ?? ""}
              onChange={(e) => onChange({ ...value, phone: e.target.value })}
              placeholder={messages.phonePlaceholder}
              className="pl-9"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export function validateContact(value: FlightContactValue): string | null {
  const messages = flightsUiEn.flightContactForm.validation
  if (!value.email?.trim()) return messages.emailRequired
  // Loose email check — adapters do their own validation
  if (!/.+@.+\..+/.test(value.email)) return messages.emailInvalid
  return null
}
