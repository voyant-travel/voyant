"use client"

import { Button } from "@voyantjs/ui/components/button"
import { Checkbox } from "@voyantjs/ui/components/checkbox"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@voyantjs/ui/components/command"
import { CountryCombobox } from "@voyantjs/ui/components/country-combobox"
import { Input } from "@voyantjs/ui/components/input"
import { Label } from "@voyantjs/ui/components/label"
import { PhoneInput } from "@voyantjs/ui/components/phone-input"
import { Popover, PopoverContent, PopoverTrigger } from "@voyantjs/ui/components/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@voyantjs/ui/components/tabs"
import { cn } from "@voyantjs/ui/lib/utils"
import { Building2, ChevronDown, User, Users } from "lucide-react"
import { type ReactNode, useState } from "react"

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
  const apply = (prefill: Partial<BillingValue>) => onChange({ ...value, ...prefill })
  const set = (patch: Partial<BillingValue>) => onChange({ ...value, ...patch })

  const hasPassengerOptions = (eligiblePassengers?.length ?? 0) > 0

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-semibold text-base">Billing</h2>
        <p className="text-muted-foreground text-sm">
          The receipt and tax documents will be issued in this name.
        </p>
      </div>

      <Tabs
        value={value.mode}
        onValueChange={(v: string) => set({ mode: (v as BillingMode) ?? "personal" })}
      >
        <TabsList>
          <TabsTrigger value="personal">
            <User className="mr-1.5 h-3.5 w-3.5" />
            Personal
          </TabsTrigger>
          <TabsTrigger value="company">
            <Building2 className="mr-1.5 h-3.5 w-3.5" />
            Company
          </TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="mt-5 flex flex-col gap-4">
          {(hasPassengerOptions || renderPersonPicker) && (
            <div className="flex flex-wrap justify-end gap-2">
              {hasPassengerOptions && (
                <PassengerPickerTrigger
                  passengers={eligiblePassengers ?? []}
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
          <NameRow value={value} onChange={set} />
          <ContactRow value={value} onChange={set} />
          <AddressBlock value={value} onChange={set} />
          <SaveDefaultRow value={value} onChange={set} />
        </TabsContent>

        <TabsContent value="company" className="mt-5 flex flex-col gap-4">
          {renderOrgPicker && <div className="flex justify-end">{renderOrgPicker(apply)}</div>}
          <CompanyRow value={value} onChange={set} />
          <ContactRow value={value} onChange={set} workPhone />
          <AddressBlock value={value} onChange={set} />
          <SaveDefaultRow value={value} onChange={set} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function NameRow({
  value,
  onChange,
}: {
  value: BillingValue
  onChange: (patch: Partial<BillingValue>) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <Field label="First name" required>
        <Input value={value.firstName} onChange={(e) => onChange({ firstName: e.target.value })} />
      </Field>
      <Field label="Last name" required>
        <Input value={value.lastName} onChange={(e) => onChange({ lastName: e.target.value })} />
      </Field>
    </div>
  )
}

function CompanyRow({
  value,
  onChange,
}: {
  value: BillingValue
  onChange: (patch: Partial<BillingValue>) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <Field label="Company name" required>
        <Input
          value={value.companyName ?? ""}
          onChange={(e) => onChange({ companyName: e.target.value })}
        />
      </Field>
      <Field label="Tax id / VAT number" required>
        <Input
          value={value.vatNumber ?? ""}
          onChange={(e) => onChange({ vatNumber: e.target.value })}
          placeholder="e.g. RO43917962"
        />
      </Field>
    </div>
  )
}

function ContactRow({
  value,
  onChange,
  workPhone,
}: {
  value: BillingValue
  onChange: (patch: Partial<BillingValue>) => void
  workPhone?: boolean
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <Field label="Email" required>
        <Input
          type="email"
          value={value.email}
          onChange={(e) => onChange({ email: e.target.value })}
        />
      </Field>
      <Field label={workPhone ? "Work phone" : "Phone"}>
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
}: {
  value: BillingValue
  onChange: (patch: Partial<BillingValue>) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <Field label="Street address" required>
        <Input
          value={value.line1}
          onChange={(e) => onChange({ line1: e.target.value })}
          placeholder="Street + number"
        />
      </Field>
      <Field label="Address line 2">
        <Input
          value={value.line2 ?? ""}
          onChange={(e) => onChange({ line2: e.target.value })}
          placeholder="Apartment, suite, etc."
        />
      </Field>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label="City" required>
          <Input value={value.city} onChange={(e) => onChange({ city: e.target.value })} />
        </Field>
        <Field label="Postal code">
          <Input
            value={value.postalCode ?? ""}
            onChange={(e) => onChange({ postalCode: e.target.value })}
          />
        </Field>
        <Field label="Country" required>
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
}: {
  value: BillingValue
  onChange: (patch: Partial<BillingValue>) => void
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
        Save these details as the default for this contact
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
  onPick,
}: {
  passengers: BillingEligiblePassenger[]
  onPick: (passenger: BillingEligiblePassenger) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button type="button" variant="outline" size="sm" className="gap-2" />}
      >
        <Users className="h-3.5 w-3.5" />
        Pick from passengers
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="end">
        <Command>
          <CommandInput placeholder="Search passengers…" />
          <CommandList>
            <CommandEmpty>No matching passengers.</CommandEmpty>
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
                    <span className="truncate font-medium text-sm">{fullName || "—"}</span>
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
  if (!v.email.trim()) return "Email is required"
  if (!/^\S+@\S+\.\S+$/.test(v.email.trim())) return "Email looks invalid"
  if (!v.line1.trim()) return "Street address is required"
  if (!v.city.trim()) return "City is required"
  if (!v.countryCode.trim()) return "Country is required"
  if (v.mode === "personal") {
    if (!v.firstName.trim()) return "First name is required"
    if (!v.lastName.trim()) return "Last name is required"
  } else {
    if (!v.companyName?.trim()) return "Company name is required"
    if (!v.vatNumber?.trim()) return "VAT / tax number is required"
  }
  return null
}
