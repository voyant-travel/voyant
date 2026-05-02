"use client"

import { useOrganizations, usePeople } from "@voyantjs/crm-react"
import type { BillingValue } from "@voyantjs/flights-ui"
import { Button } from "@voyantjs/ui/components/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@voyantjs/ui/components/command"
import { Popover, PopoverContent, PopoverTrigger } from "@voyantjs/ui/components/popover"
import { Building2, ChevronDown, Users } from "lucide-react"
import { useState } from "react"

/**
 * Billing-step CRM person picker. Searches `/v1/crm/people`, and on
 * selection looks up the picked person's primary/billing address from
 * `/v1/crm/people/:id/addresses` (with a "billing" label preferred over
 * "primary"). The result is mapped to `BillingValue` and applied via the
 * shell's prefill callback.
 *
 * Also reports the picked person's id to the parent so saved payment
 * methods can be loaded for them.
 */
export interface BillingPersonPickerProps {
  apply: (prefill: Partial<BillingValue>) => void
  onPersonSelected?: (personId: string | null) => void
}

export function BillingPersonPicker({ apply, onPersonSelected }: BillingPersonPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const peopleQuery = usePeople({
    search: search.trim() || undefined,
    limit: 30,
    enabled: open,
  })
  // Filter out minors — billing must be a legal adult. People without a
  // birthday on file are kept (we can't tell — better to allow than block).
  const people = (peopleQuery.data?.data ?? []).filter((p) => isAdult(p.birthday))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button type="button" variant="outline" size="sm" className="gap-2" />}
      >
        <Users className="h-3.5 w-3.5" />
        Use details from contact
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0" align="end">
        <Command shouldFilter={false}>
          <CommandInput value={search} onValueChange={setSearch} placeholder="Search contacts…" />
          <CommandList>
            <CommandEmpty>{peopleQuery.isLoading ? "Searching…" : "No contacts."}</CommandEmpty>
            <CommandGroup>
              {people.map((p) => {
                const fullName = `${p.firstName} ${p.lastName}`.trim()
                return (
                  <CommandItem
                    key={p.id}
                    value={`${fullName} ${p.email ?? ""}`}
                    onSelect={async () => {
                      const address = await fetchPreferredAddress("person", p.id)
                      apply({
                        mode: "personal",
                        firstName: p.firstName,
                        lastName: p.lastName,
                        email: p.email ?? "",
                        phone: p.phone ?? undefined,
                        line1: address?.line1 ?? "",
                        line2: address?.line2 ?? undefined,
                        city: address?.city ?? "",
                        region: address?.region ?? undefined,
                        postalCode: address?.postalCode ?? undefined,
                        countryCode: address?.country ?? "",
                      })
                      onPersonSelected?.(p.id)
                      setOpen(false)
                      setSearch("")
                    }}
                  >
                    <div className="flex min-w-0 flex-1 flex-col leading-tight">
                      <span className="truncate font-medium text-sm">{fullName || "—"}</span>
                      {p.email && (
                        <span className="truncate text-muted-foreground text-xs">{p.email}</span>
                      )}
                    </div>
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

/**
 * Companie-tab picker — searches CRM organizations. On pick, applies the
 * org's name + VAT + primary/billing address to the BillingValue, and
 * (if the org has a primary contact) optionally bubbles up the contact
 * person id for saved payment methods.
 */
export interface BillingOrgPickerProps {
  apply: (prefill: Partial<BillingValue>) => void
}

export function BillingOrgPicker({ apply }: BillingOrgPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const orgsQuery = useOrganizations({
    search: search.trim() || undefined,
    limit: 30,
    enabled: open,
  })
  const orgs = orgsQuery.data?.data ?? []

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button type="button" variant="outline" size="sm" className="gap-2" />}
      >
        <Building2 className="h-3.5 w-3.5" />
        Use company on file
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0" align="end">
        <Command shouldFilter={false}>
          <CommandInput value={search} onValueChange={setSearch} placeholder="Search companies…" />
          <CommandList>
            <CommandEmpty>{orgsQuery.isLoading ? "Searching…" : "No companies."}</CommandEmpty>
            <CommandGroup>
              {orgs.map((o) => (
                <CommandItem
                  key={o.id}
                  value={o.name}
                  onSelect={async () => {
                    // Fetch address + contact points in parallel — one round-trip
                    // for the picker so the form fills in one paint.
                    const [address, contactPoints] = await Promise.all([
                      fetchPreferredAddress("organization", o.id),
                      fetchContactPoints("organization", o.id),
                    ])
                    apply({
                      mode: "company",
                      companyName: o.name,
                      ...(o.vatNumber ? { vatNumber: o.vatNumber } : {}),
                      email: contactPoints.email ?? "",
                      ...(contactPoints.phone ? { phone: contactPoints.phone } : {}),
                      line1: address?.line1 ?? "",
                      line2: address?.line2 ?? undefined,
                      city: address?.city ?? "",
                      region: address?.region ?? undefined,
                      postalCode: address?.postalCode ?? undefined,
                      countryCode: address?.country ?? "",
                    })
                    setOpen(false)
                    setSearch("")
                  }}
                >
                  <div className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="truncate font-medium text-sm">{o.name}</span>
                    {o.legalName && (
                      <span className="truncate text-muted-foreground text-xs">{o.legalName}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * True when the person is at least 18 today, OR when their birthday is
 * unknown (we don't block — operator can pick and the form validates later).
 */
function isAdult(birthday: string | null | undefined): boolean {
  if (!birthday) return true
  const dob = new Date(birthday)
  if (Number.isNaN(dob.getTime())) return true
  const now = new Date()
  let years = now.getFullYear() - dob.getFullYear()
  const beforeBirthdayThisYear =
    now.getMonth() < dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())
  if (beforeBirthdayThisYear) years -= 1
  return years >= 18
}

interface IdentityAddressLite {
  label?: string
  line1?: string | null
  line2?: string | null
  city?: string | null
  region?: string | null
  postalCode?: string | null
  country?: string | null
}

/**
 * Best-effort address fetch — looks up `/v1/crm/{entity}/:id/addresses` and
 * returns the most billing-relevant entry (label === "billing" preferred,
 * then "primary", then anything marked `isPrimary`, else the first).
 *
 * Falls back to null on error so the picker still applies the rest of the
 * prefill payload (name/email).
 */
interface ContactPointSummary {
  email: string | null
  phone: string | null
}

interface ContactPointLite {
  kind: string
  value: string
  label?: string | null
  isPrimary?: boolean
}

/**
 * Best-effort identity contact-point fetch. Picks the primary email +
 * primary phone for the entity (preferring `isPrimary`, then a "billing"
 * label, else the first of each kind). Used to round out the org billing
 * prefill — for people, email/phone is already on the hydrated CRM record.
 */
async function fetchContactPoints(
  entity: "person" | "organization",
  id: string,
): Promise<ContactPointSummary> {
  const entityType = entity === "person" ? "person" : "organization"
  try {
    const res = await fetch(
      `/v1/identity/entities/${entityType}/${encodeURIComponent(id)}/contact-points`,
      { headers: { accept: "application/json" } },
    )
    if (!res.ok) return { email: null, phone: null }
    const json = (await res.json()) as { data?: ContactPointLite[] }
    const list = json.data ?? []
    return {
      email: pickContactPoint(list, "email"),
      phone: pickContactPoint(list, "phone"),
    }
  } catch {
    return { email: null, phone: null }
  }
}

function pickContactPoint(list: ContactPointLite[], kind: string): string | null {
  const matches = list.filter((c) => c.kind === kind)
  if (matches.length === 0) return null
  const billing = matches.find((c) => c.label === "billing")
  if (billing) return billing.value
  const primary = matches.find((c) => c.isPrimary)
  if (primary) return primary.value
  return matches[0]?.value ?? null
}

async function fetchPreferredAddress(
  entity: "person" | "organization",
  id: string,
): Promise<IdentityAddressLite | null> {
  const path = entity === "person" ? "people" : "organizations"
  try {
    const res = await fetch(`/v1/crm/${path}/${encodeURIComponent(id)}/addresses`, {
      headers: { accept: "application/json" },
    })
    if (!res.ok) return null
    const json = (await res.json()) as {
      data?: Array<IdentityAddressLite & { isPrimary?: boolean }>
    }
    const list = json.data ?? []
    if (list.length === 0) return null
    const billing = list.find((a) => a.label === "billing")
    if (billing) return billing
    const primary = list.find((a) => a.label === "primary") ?? list.find((a) => a.isPrimary)
    return primary ?? list[0] ?? null
  } catch {
    return null
  }
}
