"use client"

import { Input } from "@voyantjs/ui/components/input"
import { Label } from "@voyantjs/ui/components/label"
import { Mail, Phone } from "lucide-react"
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
  useFlightsUiMessagesOrDefault()
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <h3 className="mb-3 font-medium text-sm">Contact details</h3>
      <p className="mb-4 text-xs text-muted-foreground">
        Used by the airline to send confirmation, schedule changes, and operational notices for this
        booking.
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Email <span className="ml-0.5 text-destructive">*</span>
          </Label>
          <div className="relative">
            <Mail className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
            <Input
              type="email"
              autoComplete="email"
              value={value.email ?? ""}
              onChange={(e) => onChange({ ...value, email: e.target.value })}
              placeholder="traveler@example.com"
              className="pl-9"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Phone
          </Label>
          <div className="relative">
            <Phone className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
            <Input
              type="tel"
              autoComplete="tel"
              value={value.phone ?? ""}
              onChange={(e) => onChange({ ...value, phone: e.target.value })}
              placeholder="+1 555 123 4567"
              className="pl-9"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export function validateContact(value: FlightContactValue): string | null {
  if (!value.email?.trim()) return "Email is required"
  // Loose email check — adapters do their own validation
  if (!/.+@.+\..+/.test(value.email)) return "Email looks invalid"
  return null
}
