"use client"

import { useOrganizations, usePeople } from "@voyantjs/crm-react"
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/voyant-ui/components"
import { UserPlus } from "lucide-react"
import * as React from "react"

const ORG_NONE = "__none__"

export type PersonPickerMode = "existing" | "new"

export interface NewPersonValue {
  firstName: string
  lastName: string
  email: string
  phone: string
}

export interface PersonPickerValue {
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
    createNewPerson?: string
    selectExistingPerson?: string
    personSearchPlaceholder?: string
    personSelectPlaceholder?: string
    firstName?: string
    firstNamePlaceholder?: string
    lastName?: string
    lastNamePlaceholder?: string
    email?: string
    emailPlaceholder?: string
    phone?: string
    phonePlaceholder?: string
    organization?: string
    organizationSearchPlaceholder?: string
    organizationNone?: string
  }
}

const DEFAULT_LABELS = {
  person: "Person",
  createNewPerson: "Create new",
  selectExistingPerson: "Select existing",
  personSearchPlaceholder: "Search people by name or email...",
  personSelectPlaceholder: "Select a person...",
  firstName: "First Name",
  firstNamePlaceholder: "John",
  lastName: "Last Name",
  lastNamePlaceholder: "Smith",
  email: "Email",
  emailPlaceholder: "john@example.com",
  phone: "Phone",
  phonePlaceholder: "+44 7911 123456",
  organization: "Organization (optional)",
  organizationSearchPlaceholder: "Search organizations...",
  organizationNone: "No organization",
} as const

/**
 * Person picker with inline-create + optional organization attachment.
 *
 * State is fully controlled — the caller owns both existing-person selection
 * and the inline-create form. The section does *not* call any mutation itself;
 * the parent decides when to commit a newly-created person (typically at
 * submit time, so we don't leak orphan CRM records when the dialog is
 * cancelled).
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
  const merged = { ...DEFAULT_LABELS, ...labels }

  const { data: peopleData } = usePeople({
    search: personSearch || undefined,
    limit: 20,
    enabled: enabled && value.mode === "existing",
  })
  const people = peopleData?.data ?? []

  const { data: orgsData } = useOrganizations({
    search: orgSearch || undefined,
    limit: 20,
    enabled: enabled && showOrganization,
  })
  const orgs = orgsData?.data ?? []

  const setPerson = (patch: Partial<PersonPickerValue>) => onChange({ ...value, ...patch })

  return (
    <>
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
            onClick={() => setPerson({ mode: value.mode === "existing" ? "new" : "existing" })}
          >
            {value.mode === "existing" ? (
              <>
                <UserPlus className="mr-1 h-3.5 w-3.5" />
                {merged.createNewPerson}
              </>
            ) : (
              merged.selectExistingPerson
            )}
          </Button>
        </div>

        {value.mode === "existing" ? (
          <>
            <Input
              placeholder={merged.personSearchPlaceholder}
              value={personSearch}
              onChange={(e) => setPersonSearch(e.target.value)}
            />
            <Select
              items={people.map((p) => ({
                label: `${p.firstName} ${p.lastName}${p.email ? ` · ${p.email}` : ""}`,
                value: p.id,
              }))}
              value={value.personId}
              onValueChange={(v) => setPerson({ personId: v ?? "" })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={merged.personSelectPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {people.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.firstName} {p.lastName}
                    {p.email ? ` · ${p.email}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">{merged.firstName}</Label>
              <Input
                value={value.newPerson.firstName}
                onChange={(e) =>
                  setPerson({ newPerson: { ...value.newPerson, firstName: e.target.value } })
                }
                placeholder={merged.firstNamePlaceholder}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">{merged.lastName}</Label>
              <Input
                value={value.newPerson.lastName}
                onChange={(e) =>
                  setPerson({ newPerson: { ...value.newPerson, lastName: e.target.value } })
                }
                placeholder={merged.lastNamePlaceholder}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">{merged.email}</Label>
              <Input
                type="email"
                value={value.newPerson.email}
                onChange={(e) =>
                  setPerson({ newPerson: { ...value.newPerson, email: e.target.value } })
                }
                placeholder={merged.emailPlaceholder}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">{merged.phone}</Label>
              <Input
                value={value.newPerson.phone}
                onChange={(e) =>
                  setPerson({ newPerson: { ...value.newPerson, phone: e.target.value } })
                }
                placeholder={merged.phonePlaceholder}
              />
            </div>
          </div>
        )}
      </div>

      {showOrganization && (
        <div className="flex flex-col gap-2">
          <Label>{merged.organization}</Label>
          <Input
            placeholder={merged.organizationSearchPlaceholder}
            value={orgSearch}
            onChange={(e) => setOrgSearch(e.target.value)}
          />
          <Select
            items={[
              { label: merged.organizationNone, value: ORG_NONE },
              ...orgs.map((o) => ({ label: o.name, value: o.id })),
            ]}
            value={value.organizationId ?? ORG_NONE}
            onValueChange={(v) =>
              setPerson({ organizationId: v === ORG_NONE ? null : (v ?? null) })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={merged.organizationNone} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ORG_NONE}>{merged.organizationNone}</SelectItem>
              {orgs.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </>
  )
}
