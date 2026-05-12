"use client"

import {
  type OrganizationRecord,
  type PersonRecord,
  useOrganization,
  useOrganizations,
  usePeople,
  usePerson,
} from "@voyantjs/crm-react"
import { OrganizationForm, PersonForm } from "@voyantjs/crm-ui"
import {
  Button,
  Label,
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@voyantjs/ui/components"
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@voyantjs/ui/components/combobox"
import { Building2, User, UserPlus } from "lucide-react"
import * as React from "react"
import { useBookingsUiMessagesOrDefault } from "../i18n/provider.js"

export type PersonPickerMode = "existing" | "new"
export type BillingTargetMode = "person" | "organization"

export interface NewPersonValue {
  firstName: string
  lastName: string
  email: string
  phone: string
}

export interface PersonPickerValue {
  billTo?: BillingTargetMode
  mode: PersonPickerMode
  /** Set when mode === "existing". */
  personId: string
  /** Used when mode === "new". */
  newPerson: NewPersonValue
  /** `null` = no organization attached. */
  organizationId: string | null
}

export const emptyNewPerson: NewPersonValue = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
}

export const emptyPersonPickerValue: PersonPickerValue = {
  billTo: "person",
  mode: "existing",
  personId: "",
  newPerson: emptyNewPerson,
  organizationId: null,
}

export interface PersonPickerSectionProps {
  value: PersonPickerValue
  onChange: (value: PersonPickerValue) => void
  enabled?: boolean
  showOrganization?: boolean
  labels?: {
    person?: string
    organization?: string
    billTo?: string
    billToPerson?: string
    billToOrganization?: string
    createNewPerson?: string
    createNewOrganization?: string
    createPersonSheetTitle?: string
    createOrganizationSheetTitle?: string
    selectExistingPerson?: string
    personSearchPlaceholder?: string
    personSelectPlaceholder?: string
    personEmpty?: string
    firstName?: string
    firstNamePlaceholder?: string
    lastName?: string
    lastNamePlaceholder?: string
    email?: string
    emailPlaceholder?: string
    phone?: string
    phonePlaceholder?: string
    organizationSearchPlaceholder?: string
    organizationSelectPlaceholder?: string
    organizationEmpty?: string
    organizationNone?: string
  }
}

/**
 * Billing target picker for booking create.
 *
 * State is fully controlled. The embedded create sheets use the CRM forms and
 * select the newly-created person or organization after save.
 */
export function PersonPickerSection({
  value,
  onChange,
  enabled = true,
  showOrganization = true,
  labels,
}: PersonPickerSectionProps) {
  const [personSearch, setPersonSearch] = React.useState("")
  const [orgSearch, setOrgSearch] = React.useState("")
  const [personInputValue, setPersonInputValue] = React.useState("")
  const [orgInputValue, setOrgInputValue] = React.useState("")
  const [personSheetOpen, setPersonSheetOpen] = React.useState(false)
  const [orgSheetOpen, setOrgSheetOpen] = React.useState(false)
  const messages = useBookingsUiMessagesOrDefault()
  const merged = { ...messages.personPickerSection.labels, ...labels }
  const billingTarget = value.billTo ?? "person"

  const { data: peopleData } = usePeople({
    search: personSearch || undefined,
    limit: 20,
    enabled: enabled && billingTarget === "person",
  })
  const selectedPersonQuery = usePerson(value.personId || undefined, {
    enabled: enabled && billingTarget === "person" && Boolean(value.personId),
  })
  const people = React.useMemo(() => {
    const map = new Map<string, PersonRecord>()
    for (const person of peopleData?.data ?? []) map.set(person.id, person)
    if (selectedPersonQuery.data) map.set(selectedPersonQuery.data.id, selectedPersonQuery.data)
    return Array.from(map.values())
  }, [peopleData?.data, selectedPersonQuery.data])
  const peopleMap = React.useMemo(
    () => new Map(people.map((person) => [person.id, person])),
    [people],
  )

  const { data: orgsData } = useOrganizations({
    search: orgSearch || undefined,
    limit: 20,
    enabled: enabled && showOrganization && billingTarget === "organization",
  })
  const selectedOrgQuery = useOrganization(value.organizationId || undefined, {
    enabled: enabled && billingTarget === "organization" && Boolean(value.organizationId),
  })
  const orgs = React.useMemo(() => {
    const map = new Map<string, OrganizationRecord>()
    for (const org of orgsData?.data ?? []) map.set(org.id, org)
    if (selectedOrgQuery.data) map.set(selectedOrgQuery.data.id, selectedOrgQuery.data)
    return Array.from(map.values())
  }, [orgsData?.data, selectedOrgQuery.data])
  const orgsMap = React.useMemo(() => new Map(orgs.map((org) => [org.id, org])), [orgs])

  const setPerson = (patch: Partial<PersonPickerValue>) => onChange({ ...value, ...patch })
  const selectedPersonLabel = value.personId ? formatPerson(peopleMap.get(value.personId)) : ""
  const selectedOrgLabel = value.organizationId
    ? (orgsMap.get(value.organizationId)?.name ?? "")
    : ""

  React.useEffect(() => {
    if (selectedPersonLabel) setPersonInputValue(selectedPersonLabel)
  }, [selectedPersonLabel])

  React.useEffect(() => {
    if (selectedOrgLabel) setOrgInputValue(selectedOrgLabel)
  }, [selectedOrgLabel])

  return (
    <>
      <div className="flex flex-col gap-2">
        <Label>{merged.billTo}</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={billingTarget === "person" ? "default" : "outline"}
            onClick={() => setPerson({ billTo: "person", organizationId: null })}
            disabled={!enabled}
          >
            <User className="mr-2 h-4 w-4" />
            {merged.billToPerson}
          </Button>
          <Button
            type="button"
            variant={billingTarget === "organization" ? "default" : "outline"}
            onClick={() => setPerson({ billTo: "organization", personId: "" })}
            disabled={!enabled || !showOrganization}
          >
            <Building2 className="mr-2 h-4 w-4" />
            {merged.billToOrganization}
          </Button>
        </div>
      </div>

      {billingTarget === "person" ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label>
              {merged.person} <span className="text-destructive">*</span>
            </Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() => setPersonSheetOpen(true)}
              disabled={!enabled}
            >
              <UserPlus className="mr-1 h-3.5 w-3.5" />
              {merged.createNewPerson}
            </Button>
          </div>
          <Combobox
            items={people.map((person) => person.id)}
            value={value.personId || null}
            inputValue={personInputValue}
            autoHighlight
            disabled={!enabled}
            itemToStringValue={(id) => formatPerson(peopleMap.get(id as string))}
            onInputValueChange={(next) => {
              setPersonInputValue(next)
              setPersonSearch(next)
              if (!next) setPerson({ personId: "" })
            }}
            onValueChange={(next) => {
              const personId = (next as string | null) ?? ""
              setPerson({ personId })
              setPersonInputValue(personId ? formatPerson(peopleMap.get(personId)) : "")
            }}
          >
            <ComboboxInput
              placeholder={merged.personSearchPlaceholder}
              showClear={!!value.personId}
            />
            <ComboboxContent>
              <ComboboxEmpty>{merged.personEmpty}</ComboboxEmpty>
              <ComboboxList>
                <ComboboxCollection>
                  {(id) => {
                    const person = peopleMap.get(id as string)
                    if (!person) return null
                    return (
                      <ComboboxItem key={person.id} value={person.id}>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">{formatPersonName(person)}</span>
                          {person.email ? (
                            <span className="truncate text-xs text-muted-foreground">
                              {person.email}
                            </span>
                          ) : null}
                        </div>
                      </ComboboxItem>
                    )
                  }}
                </ComboboxCollection>
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label>
              {merged.organization} <span className="text-destructive">*</span>
            </Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() => setOrgSheetOpen(true)}
              disabled={!enabled}
            >
              <Building2 className="mr-1 h-3.5 w-3.5" />
              {merged.createNewOrganization}
            </Button>
          </div>
          <Combobox
            items={orgs.map((org) => org.id)}
            value={value.organizationId ?? null}
            inputValue={orgInputValue}
            autoHighlight
            disabled={!enabled}
            itemToStringValue={(id) => orgsMap.get(id as string)?.name ?? ""}
            onInputValueChange={(next) => {
              setOrgInputValue(next)
              setOrgSearch(next)
              if (!next) setPerson({ organizationId: null })
            }}
            onValueChange={(next) => {
              const organizationId = (next as string | null) ?? null
              setPerson({ organizationId })
              setOrgInputValue(organizationId ? (orgsMap.get(organizationId)?.name ?? "") : "")
            }}
          >
            <ComboboxInput
              placeholder={merged.organizationSearchPlaceholder}
              showClear={!!value.organizationId}
            />
            <ComboboxContent>
              <ComboboxEmpty>{merged.organizationEmpty}</ComboboxEmpty>
              <ComboboxList>
                <ComboboxCollection>
                  {(id) => {
                    const org = orgsMap.get(id as string)
                    if (!org) return null
                    return (
                      <ComboboxItem key={org.id} value={org.id}>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">{org.name}</span>
                          {org.legalName ? (
                            <span className="truncate text-xs text-muted-foreground">
                              {org.legalName}
                            </span>
                          ) : null}
                        </div>
                      </ComboboxItem>
                    )
                  }}
                </ComboboxCollection>
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>
      )}

      <Sheet open={personSheetOpen} onOpenChange={setPersonSheetOpen}>
        <SheetContent side="right" size="lg">
          <SheetHeader>
            <SheetTitle>{merged.createPersonSheetTitle}</SheetTitle>
          </SheetHeader>
          <SheetBody>
            <PersonForm
              mode={{ kind: "create" }}
              onCancel={() => setPersonSheetOpen(false)}
              onSuccess={(saved) => {
                setPerson({ billTo: "person", personId: saved.id, organizationId: null })
                setPersonInputValue(formatPerson(saved))
                setPersonSheetOpen(false)
              }}
            />
          </SheetBody>
        </SheetContent>
      </Sheet>

      <Sheet open={orgSheetOpen} onOpenChange={setOrgSheetOpen}>
        <SheetContent side="right" size="lg">
          <SheetHeader>
            <SheetTitle>{merged.createOrganizationSheetTitle}</SheetTitle>
          </SheetHeader>
          <SheetBody>
            <OrganizationForm
              mode={{ kind: "create" }}
              onCancel={() => setOrgSheetOpen(false)}
              onSuccess={(saved) => {
                setPerson({ billTo: "organization", personId: "", organizationId: saved.id })
                setOrgInputValue(saved.name)
                setOrgSheetOpen(false)
              }}
            />
          </SheetBody>
        </SheetContent>
      </Sheet>
    </>
  )
}

function formatPersonName(person: PersonRecord | undefined): string {
  if (!person) return ""
  return [person.firstName, person.lastName].filter(Boolean).join(" ").trim()
}

function formatPerson(person: PersonRecord | undefined): string {
  if (!person) return ""
  const name = formatPersonName(person)
  return person.email ? `${name} · ${person.email}` : name
}
