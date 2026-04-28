"use client"

import {
  type CreatePersonInput,
  type OrganizationRecord,
  type PersonRecord,
  useOrganization,
  useOrganizations,
  usePersonMutation,
} from "@voyantjs/crm-react"
import { Button } from "@voyantjs/ui/components/button"
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@voyantjs/ui/components/combobox"
import { Input } from "@voyantjs/ui/components/input"
import { Label } from "@voyantjs/ui/components/label"
import { Loader2 } from "lucide-react"
import * as React from "react"
import { useAdminMessages } from "@/lib/admin-i18n"

type Mode = { kind: "create" } | { kind: "edit"; person: PersonRecord }

export interface PersonFormProps {
  mode: Mode
  onSuccess?: (person: PersonRecord) => void
  onCancel?: () => void
}

interface FormState {
  firstName: string
  lastName: string
  organizationId: string
  email: string
  phone: string
  jobTitle: string
}

function initialState(mode: Mode): FormState {
  if (mode.kind === "edit") {
    const p = mode.person
    return {
      firstName: p.firstName ?? "",
      lastName: p.lastName ?? "",
      organizationId: p.organizationId ?? "",
      email: p.email ?? "",
      phone: p.phone ?? "",
      jobTitle: p.jobTitle ?? "",
    }
  }
  return {
    firstName: "",
    lastName: "",
    organizationId: "",
    email: "",
    phone: "",
    jobTitle: "",
  }
}

function toPayload(state: FormState): CreatePersonInput {
  return {
    firstName: state.firstName.trim(),
    lastName: state.lastName.trim(),
    organizationId: state.organizationId.trim() || null,
    email: state.email.trim() || null,
    phone: state.phone.trim() || null,
    jobTitle: state.jobTitle.trim() || null,
  }
}

function OrganizationCombobox({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [search, setSearch] = React.useState("")
  const organizationsQuery = useOrganizations({
    search: search || undefined,
    limit: 25,
  })
  const selectedOrganizationQuery = useOrganization(value || undefined, {
    enabled: !!value,
  })

  const options = React.useMemo(() => {
    const map = new Map<string, OrganizationRecord>()
    for (const organization of organizationsQuery.data?.data ?? []) {
      map.set(organization.id, organization)
    }
    if (selectedOrganizationQuery.data) {
      map.set(selectedOrganizationQuery.data.id, selectedOrganizationQuery.data)
    }
    return Array.from(map.values())
  }, [organizationsQuery.data?.data, selectedOrganizationQuery.data])

  const optionMap = React.useMemo(
    () => new Map(options.map((organization) => [organization.id, organization])),
    [options],
  )
  const selected = value ? optionMap.get(value) : undefined
  const selectedLabel = selected?.name ?? ""
  const [inputValue, setInputValue] = React.useState(selectedLabel)

  React.useEffect(() => {
    setInputValue(selectedLabel)
  }, [selectedLabel])

  return (
    <Combobox
      items={options.map((organization) => organization.id)}
      value={value || null}
      inputValue={inputValue}
      autoHighlight
      itemToStringValue={(id) => optionMap.get(id as string)?.name ?? ""}
      onInputValueChange={(next) => {
        setInputValue(next)
        setSearch(next)
        if (!next) onChange("")
      }}
      onValueChange={(next) => {
        const resolved = (next as string | null) ?? ""
        onChange(resolved)
        setInputValue(resolved ? (optionMap.get(resolved)?.name ?? "") : "")
      }}
    >
      <ComboboxInput placeholder="Search organizations..." showClear={!!value} />
      <ComboboxContent>
        <ComboboxEmpty>
          {organizationsQuery.isPending || selectedOrganizationQuery.isPending
            ? "Loading organizations..."
            : "No organizations found."}
        </ComboboxEmpty>
        <ComboboxList>
          <ComboboxCollection>
            {(id) => {
              const organization = optionMap.get(id as string)
              if (!organization) return null
              return (
                <ComboboxItem key={organization.id} value={organization.id}>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{organization.name}</span>
                    {organization.website || organization.legalName ? (
                      <span className="truncate text-xs text-muted-foreground">
                        {organization.website || organization.legalName}
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
  )
}

/**
 * Create/edit form for a Person. Validates via the server-side Zod schema
 * exposed on `/api/v1/crm/people` — client-side errors surface as toast-
 * friendly `VoyantApiError`s inside the mutation.
 */
export function PersonForm({ mode, onSuccess, onCancel }: PersonFormProps) {
  const messages = useAdminMessages().crm.personForm
  const [state, setState] = React.useState<FormState>(() => initialState(mode))
  const [error, setError] = React.useState<string | null>(null)
  const { create, update } = usePersonMutation()

  React.useEffect(() => {
    setState(initialState(mode))
    setError(null)
  }, [mode])

  const isSubmitting = create.isPending || update.isPending

  const field =
    <K extends keyof FormState>(key: K) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setState((prev) => ({ ...prev, [key]: e.target.value }))
    }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!state.firstName.trim() || !state.lastName.trim()) {
      setError(messages.validationNameRequired)
      return
    }

    const payload = toPayload(state)

    try {
      const person =
        mode.kind === "create"
          ? await create.mutateAsync(payload)
          : await update.mutateAsync({ id: mode.person.id, input: payload })
      onSuccess?.(person)
    } catch (err) {
      setError(err instanceof Error ? err.message : messages.saveFailed)
    }
  }

  return (
    <form data-slot="person-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="person-first-name">{messages.firstNameLabel}</Label>
          <Input
            id="person-first-name"
            required
            value={state.firstName}
            onChange={field("firstName")}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="person-last-name">{messages.lastNameLabel}</Label>
          <Input
            id="person-last-name"
            required
            value={state.lastName}
            onChange={field("lastName")}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="person-job-title">{messages.jobTitleLabel}</Label>
          <Input id="person-job-title" value={state.jobTitle} onChange={field("jobTitle")} />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label>Organization</Label>
          <OrganizationCombobox
            value={state.organizationId}
            onChange={(organizationId) => setState((prev) => ({ ...prev, organizationId }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="person-email">{messages.emailLabel}</Label>
          <Input id="person-email" type="email" value={state.email} onChange={field("email")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="person-phone">{messages.phoneLabel}</Label>
          <Input id="person-phone" value={state.phone} onChange={field("phone")} />
        </div>
      </div>

      {error ? (
        <p data-slot="person-form-error" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            {messages.cancel}
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
              {messages.saving}
            </>
          ) : mode.kind === "create" ? (
            messages.create
          ) : (
            messages.saveChanges
          )}
        </Button>
      </div>
    </form>
  )
}
