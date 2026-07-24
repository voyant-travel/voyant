"use client"

import { Button } from "@voyant-travel/ui/components/button"
import { Checkbox } from "@voyant-travel/ui/components/checkbox"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@voyant-travel/ui/components/command"
import { CountryCombobox } from "@voyant-travel/ui/components/country-combobox"
import { Input } from "@voyant-travel/ui/components/input"
import { Label } from "@voyant-travel/ui/components/label"
import { PhoneInput } from "@voyant-travel/ui/components/phone-input"
import { Popover, PopoverContent, PopoverTrigger } from "@voyant-travel/ui/components/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@voyant-travel/ui/components/tabs"
import { cn } from "@voyant-travel/ui/lib/utils"
import { Building2, ChevronDown, User, Users } from "lucide-react"
import { type ReactNode, useState } from "react"
import { flightsUiEn } from "../i18n/en.js"
import { useFlightsUiMessagesOrDefault } from "../i18n/index.js"

/** Tab id — Privat (personal) vs Companie (business invoicing). */
export type BillingMode = "personal" | "company"

export interface BillingValue {
  mode: BillingMode
  /** Personal: pax / billing-recipient first name. */
  firstName: string
  /** Personal: pax / billing-recipient last name. */
  lastName: string
  email: string
  phone?: string
  /** Postal address — same shape as `BillingAddress` from the contract. */
  line1: string
  line2?: string
  city: string
  region?: string
  postalCode?: string
  /** ISO 3166-1 alpha-2. */
  countryCode: string
  /** Company tab — required when mode === "company". */
  companyName?: string
  vatNumber?: string
  /** "Save as default" toggle — parent decides what to do with it. */
  saveAsDefault?: boolean
}

/** A booking passenger eligible to be the billing recipient. */
export interface BillingEligiblePassenger {
  id: string
  firstName: string
  middleName?: string
  lastName: string
}

export interface FlightBillingStepProps {
  value: BillingValue
  onChange: (next: BillingValue) => void
  /**
   * Adult passengers from the booking who can stand in as the billing
   * recipient. Children + infants are filtered out by the parent — a kid
   * can never be the billing person. When non-empty, a "Pick from
   * passengers" trigger appears alongside the contact picker.
   */
  eligiblePassengers?: BillingEligiblePassenger[]
  /**
   * Render slot for a person picker (e.g. CRM "Use details from contact").
   * The parent supplies a CRM-aware picker that, on selection, calls
   * `applyPrefill` with the relevant fields. Set null/undefined to omit.
   */
  renderPersonPicker?: (apply: (prefill: Partial<BillingValue>) => void) => ReactNode
  /**
   * Render slot for an organization picker (Companie tab). On selection,
   * `applyPrefill` is called with company name + VAT + address.
   */
  renderOrgPicker?: (apply: (prefill: Partial<BillingValue>) => void) => ReactNode
}

/**
 * Two-tab billing step with Privat (personal) + Companie (business / VAT)
 * shapes. Address fields are structured (line1/city/postal/country) so the
 * payload maps cleanly to `BillingAddress` on the payment intent. Pickers
 * for prefill from CRM are supplied as render-prop slots so this component
 * stays decoupled from the CRM data layer.
 */
export function FlightBillingStep({
  value,
  onChange,
  eligiblePassengers,
  renderPersonPicker,
  renderOrgPicker,
}: FlightBillingStepProps) {
  const messages = useFlightsUiMessagesOrDefault()
  const apply = (prefill: Partial<BillingValue>) => onChange({ ...value, ...prefill })
  const set = (patch: Partial<BillingValue>) => onChange({ ...value, ...patch })

  const hasPassengerOptions = (eligiblePassengers?.length ?? 0) > 0

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-semibold text-base">{messages.flightBillingStep.title}</h2>
        <p className="text-muted-foreground text-sm">{messages.flightBillingStep.description}</p>
      </div>

      <Tabs
        value={value.mode}
        onValueChange={(v: string) => set({ mode: (v as BillingMode) ?? "personal" })}
      >
        <TabsList>
          <TabsTrigger value="personal">
            <User className="mr-1.5 h-3.5 w-3.5" />
            {messages.flightBillingStep.tabs.personal}
          </TabsTrigger>
          <TabsTrigger value="company">
            <Building2 className="mr-1.5 h-3.5 w-3.5" />
            {messages.flightBillingStep.tabs.company}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="mt-5 flex flex-col gap-4">
          {(hasPassengerOptions || renderPersonPicker) && (
            <div className="flex flex-wrap justify-end gap-2">
              {hasPassengerOptions && (
                <PassengerPickerTrigger
                  passengers={eligiblePassengers ?? []}
                  messages={messages}
                  onPick={(p) =>
                    apply({
                      mode: "personal",
                      firstName: p.firstName,
                      ...(p.middleName ? { middleName: p.middleName } : {}),
                      lastName: p.lastName,
                    })
                  }
                />
              )}
              {renderPersonPicker?.(apply)}
            </div>
          )}
          <NameRow value={value} onChange={set} messages={messages} />
          <ContactRow value={value} onChange={set} messages={messages} />
          <AddressBlock value={value} onChange={set} messages={messages} />
          <SaveDefaultRow value={value} onChange={set} messages={messages} />
        </TabsContent>

        <TabsContent value="company" className="mt-5 flex flex-col gap-4">
          {renderOrgPicker && <div className="flex justify-end">{renderOrgPicker(apply)}</div>}
          <CompanyRow value={value} onChange={set} messages={messages} />
          <ContactRow value={value} onChange={set} workPhone messages={messages} />
          <AddressBlock value={value} onChange={set} messages={messages} />
          <SaveDefaultRow value={value} onChange={set} messages={messages} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function NameRow({
  value,
  onChange,
  messages,
}: {
  value: BillingValue
  onChange: (patch: Partial<BillingValue>) => void
  messages: ReturnType<typeof useFlightsUiMessagesOrDefault>
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <Field label={messages.flightBillingStep.fields.firstName} required>
        <Input value={value.firstName} onChange={(e) => onChange({ firstName: e.target.value })} />
      </Field>
      <Field label={messages.flightBillingStep.fields.lastName} required>
        <Input value={value.lastName} onChange={(e) => onChange({ lastName: e.target.value })} />
      </Field>
    </div>
  )
}

function CompanyRow({
  value,
  onChange,
  messages,
}: {
  value: BillingValue
  onChange: (patch: Partial<BillingValue>) => void
  messages: ReturnType<typeof useFlightsUiMessagesOrDefault>
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <Field label={messages.flightBillingStep.fields.companyName} required>
        <Input
          value={value.companyName ?? ""}
          onChange={(e) => onChange({ companyName: e.target.value })}
        />
      </Field>
      <Field label={messages.flightBillingStep.fields.vatNumber} required>
        <Input
          value={value.vatNumber ?? ""}
          onChange={(e) => onChange({ vatNumber: e.target.value })}
          placeholder={messages.flightBillingStep.placeholders.vatNumber}
        />
      </Field>
    </div>
  )
}

function ContactRow({
  value,
  onChange,
  workPhone,
  messages,
}: {
  value: BillingValue
  onChange: (patch: Partial<BillingValue>) => void
  workPhone?: boolean
  messages: ReturnType<typeof useFlightsUiMessagesOrDefault>
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <Field label={messages.flightBillingStep.fields.email} required>
        <Input
          type="email"
          value={value.email}
          onChange={(e) => onChange({ email: e.target.value })}
        />
      </Field>
      <Field
        label={
          workPhone
            ? messages.flightBillingStep.fields.workPhone
            : messages.flightBillingStep.fields.phone
        }
      >
        <PhoneInput
          value={(value.phone ?? "") as never}
          onChange={(v) => onChange({ phone: v ? String(v) : undefined })}
          defaultCountry="RO"
          international
        />
      </Field>
    </div>
  )
}

function AddressBlock({
  value,
  onChange,
  messages,
}: {
  value: BillingValue
  onChange: (patch: Partial<BillingValue>) => void
  messages: ReturnType<typeof useFlightsUiMessagesOrDefault>
}) {
  return (
    <div className="flex flex-col gap-3">
      <Field label={messages.flightBillingStep.fields.streetAddress} required>
        <Input
          value={value.line1}
          onChange={(e) => onChange({ line1: e.target.value })}
          placeholder={messages.flightBillingStep.placeholders.streetAddress}
        />
      </Field>
      <Field label={messages.flightBillingStep.fields.addressLine2}>
        <Input
          value={value.line2 ?? ""}
          onChange={(e) => onChange({ line2: e.target.value })}
          placeholder={messages.flightBillingStep.placeholders.addressLine2}
        />
      </Field>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label={messages.flightBillingStep.fields.city} required>
          <Input value={value.city} onChange={(e) => onChange({ city: e.target.value })} />
        </Field>
        <Field label={messages.flightBillingStep.fields.postalCode}>
          <Input
            value={value.postalCode ?? ""}
            onChange={(e) => onChange({ postalCode: e.target.value })}
          />
        </Field>
        <Field label={messages.flightBillingStep.fields.country} required>
          <CountryCombobox
            value={value.countryCode || null}
            onChange={(code) => onChange({ countryCode: code ?? "" })}
          />
        </Field>
      </div>
    </div>
  )
}

function SaveDefaultRow({
  value,
  onChange,
  messages,
}: {
  value: BillingValue
  onChange: (patch: Partial<BillingValue>) => void
  messages: ReturnType<typeof useFlightsUiMessagesOrDefault>
}) {
  const id = "billing-save-default"
  return (
    <div className="flex items-center gap-2 text-muted-foreground text-sm">
      <Checkbox
        id={id}
        checked={!!value.saveAsDefault}
        onCheckedChange={(v) => onChange({ saveAsDefault: !!v })}
      />
      <label htmlFor={id} className="cursor-pointer">
        {messages.flightBillingStep.saveDefault}
      </label>
    </div>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className={cn("text-[11px] uppercase tracking-wider text-muted-foreground")}>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compact "Pick from passengers" popover. Lists adult passengers entered
 * upstream — the operator can click one to copy their first/middle/last name
 * into the billing recipient. Self-contained: doesn't depend on CRM data.
 */
function PassengerPickerTrigger({
  passengers,
  messages,
  onPick,
}: {
  passengers: BillingEligiblePassenger[]
  messages: ReturnType<typeof useFlightsUiMessagesOrDefault>
  onPick: (passenger: BillingEligiblePassenger) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button type="button" variant="outline" size="sm" className="gap-2" />}
      >
        <Users className="h-3.5 w-3.5" />
        {messages.flightBillingStep.pickFromPassengers}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="end">
        <Command>
          <CommandInput placeholder={messages.flightBillingStep.placeholders.searchPassengers} />
          <CommandList>
            <CommandEmpty>{messages.flightBillingStep.noMatchingPassengers}</CommandEmpty>
            <CommandGroup>
              {passengers.map((p) => {
                const fullName = [p.firstName, p.middleName, p.lastName]
                  .filter((s) => s?.trim())
                  .join(" ")
                return (
                  <CommandItem
                    key={p.id}
                    value={fullName}
                    onSelect={() => {
                      onPick(p)
                      setOpen(false)
                    }}
                  >
                    <span className="truncate font-medium text-sm">
                      {fullName || messages.common.noValue}
                    </span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function emptyBillingValue(): BillingValue {
  return {
    mode: "personal",
    firstName: "",
    lastName: "",
    email: "",
    line1: "",
    city: "",
    countryCode: "",
  }
}

/**
 * Validate the billing value. Returns the first error message, or null
 * when valid. Drives the journey's Continue gate.
 */
export function validateBilling(v: BillingValue): string | null {
  const messages = flightsUiEn.flightBillingStep.validation
  if (!v.email.trim()) return messages.emailRequired
  if (!/^\S+@\S+\.\S+$/.test(v.email.trim())) return messages.emailInvalid
  if (!v.line1.trim()) return messages.streetAddressRequired
  if (!v.city.trim()) return messages.cityRequired
  if (!v.countryCode.trim()) return messages.countryRequired
  if (v.mode === "personal") {
    if (!v.firstName.trim()) return messages.firstNameRequired
    if (!v.lastName.trim()) return messages.lastNameRequired
  } else {
    if (!v.companyName?.trim()) return messages.companyNameRequired
    if (!v.vatNumber?.trim()) return messages.vatNumberRequired
  }
  return null
}
