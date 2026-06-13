"use client"

import { AsyncCombobox } from "@voyantjs/ui/components/async-combobox"
import * as React from "react"
import { useCrmUiMessagesOrDefault } from "../i18n/index.js"
import { type PersonRecord, usePeople, usePerson } from "../index.js"

export interface PersonComboboxProps {
  value: string | null | undefined
  onChange: (value: string | null) => void
  placeholder?: string
  emptyText?: string
  disabled?: boolean
  className?: string
  triggerClassName?: string
  clearable?: boolean
  limit?: number
}

const DEFAULT_LIMIT = 20

function compact(parts: Array<string | null | undefined>) {
  return parts.map((part) => part?.trim()).filter(Boolean) as string[]
}

function formatPersonLabel(person: PersonRecord) {
  const name = compact([person.firstName, person.lastName]).join(" ")
  return name || person.email || person.id
}

function formatPersonSecondary(person: PersonRecord) {
  return compact([person.email, person.jobTitle, person.phone]).join(" - ")
}

export function PersonCombobox({
  value,
  onChange,
  placeholder,
  emptyText,
  disabled,
  className,
  triggerClassName,
  clearable = true,
  limit = DEFAULT_LIMIT,
}: PersonComboboxProps) {
  const messages = useCrmUiMessagesOrDefault().entityComboboxes.person
  const [search, setSearch] = React.useState("")
  const listQuery = usePeople({ search: search || undefined, limit })
  const selectedQuery = usePerson(value ?? undefined, { enabled: Boolean(value) })

  return (
    <AsyncCombobox<PersonRecord>
      value={value ?? null}
      onChange={onChange}
      items={listQuery.data?.data ?? []}
      selectedItem={selectedQuery.data ?? null}
      getKey={(person) => person.id}
      getLabel={formatPersonLabel}
      getSecondary={formatPersonSecondary}
      onSearchChange={setSearch}
      placeholder={placeholder ?? messages.placeholder}
      emptyText={
        listQuery.isPending || selectedQuery.isPending
          ? messages.loading
          : (emptyText ?? messages.empty)
      }
      disabled={disabled}
      className={className}
      triggerClassName={triggerClassName}
      clearable={clearable}
    />
  )
}
