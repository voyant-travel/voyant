"use client"

import { useOrganizations, usePeople } from "@voyantjs/crm-react"
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

import { useFlightsUiMessagesOrDefault } from "../i18n/index.js"
import type { BillingValue } from "./flight-billing-step.js"

export interface BillingPersonPickerProps {
  apply: (prefill: Partial<BillingValue>) => void
  onPersonSelected?: (personId: string | null) => void
}

/**
 * Billing-step CRM person picker. It searches `/v1/crm/people`, prefers a
 * billing/primary address, and maps the selected person into `BillingValue`.
 */
export function BillingPersonPicker({ apply, onPersonSelected }: BillingPersonPickerProps) {
  const messages = useFlightsUiMessagesOrDefault().billingPickers
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const peopleQuery = usePeople({
    search: search.trim() || undefined,
    limit: 30,
    enabled: open,
  })
  const people = (peopleQuery.data?.data ?? []).filter((person) => isAdult(person.birthday))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button type="button" variant="outline" size="sm" className="gap-2" />}
      >
        <Users className="h-3.5 w-3.5" />
        {messages.personTrigger}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0" align="end">
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder={messages.personSearchPlaceholder}
          />
          <CommandList>
            <CommandEmpty>
              {peopleQuery.isLoading ? messages.peopleSearching : messages.peopleEmpty}
            </CommandEmpty>
            <CommandGroup>
              {people.map((person) => {
                const fullName = `${person.firstName} ${person.lastName}`.trim()
                return (
                  <CommandItem
                    key={person.id}
                    value={`${fullName} ${person.email ?? ""}`}
                    onSelect={async () => {
                      const address = await fetchPreferredAddress("person", person.id)
                      apply({
                        mode: "personal",
                        firstName: person.firstName,
                        lastName: person.lastName,
                        email: person.email ?? "",
                        phone: person.phone ?? undefined,
                        line1: address?.line1 ?? "",
                        line2: address?.line2 ?? undefined,
                        city: address?.city ?? "",
                        region: address?.region ?? undefined,
                        postalCode: address?.postalCode ?? undefined,
                        countryCode: address?.country ?? "",
                      })
                      onPersonSelected?.(person.id)
                      setOpen(false)
                      setSearch("")
                    }}
                  >
                    <div className="flex min-w-0 flex-1 flex-col leading-tight">
                      <span className="truncate font-medium text-sm">
                        {fullName || messages.emptyName}
                      </span>
                      {person.email && (
                        <span className="truncate text-muted-foreground text-xs">
                          {person.email}
                        </span>
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

export interface BillingOrgPickerProps {
  apply: (prefill: Partial<BillingValue>) => void
}

/**
 * Billing-step CRM organization picker. It searches organizations and maps
 * the selected organization, address, and contact points into `BillingValue`.
 */
export function BillingOrgPicker({ apply }: BillingOrgPickerProps) {
  const messages = useFlightsUiMessagesOrDefault().billingPickers
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
        {messages.orgTrigger}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0" align="end">
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder={messages.orgSearchPlaceholder}
          />
          <CommandList>
            <CommandEmpty>
              {orgsQuery.isLoading ? messages.orgsSearching : messages.orgsEmpty}
            </CommandEmpty>
            <CommandGroup>
              {orgs.map((org) => (
                <CommandItem
                  key={org.id}
                  value={org.name}
                  onSelect={async () => {
                    const [address, contactPoints] = await Promise.all([
                      fetchPreferredAddress("organization", org.id),
                      fetchContactPoints("organization", org.id),
                    ])
                    apply({
                      mode: "company",
                      companyName: org.name,
                      ...(org.vatNumber ? { vatNumber: org.vatNumber } : {}),
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
                    <span className="truncate font-medium text-sm">{org.name}</span>
                    {org.legalName && (
                      <span className="truncate text-muted-foreground text-xs">
                        {org.legalName}
                      </span>
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
  const matches = list.filter((contactPoint) => contactPoint.kind === kind)
  if (matches.length === 0) return null
  const billing = matches.find((contactPoint) => contactPoint.label === "billing")
  if (billing) return billing.value
  const primary = matches.find((contactPoint) => contactPoint.isPrimary)
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
    const billing = list.find((address) => address.label === "billing")
    if (billing) return billing
    const primary =
      list.find((address) => address.label === "primary") ??
      list.find((address) => address.isPrimary)
    return primary ?? list[0] ?? null
  } catch {
    return null
  }
}
