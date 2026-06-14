"use client"

import { AsyncCombobox } from "@voyant-travel/ui/components/async-combobox"
import * as React from "react"
import { useCrmUiMessagesOrDefault } from "../i18n/index.js"
import { type OrganizationRecord, useOrganization, useOrganizations } from "../index.js"

export interface OrganizationComboboxProps {
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

function formatOrganizationSecondary(organization: OrganizationRecord) {
  return compact([
    organization.legalName,
    organization.taxId,
    organization.website,
    organization.industry,
    organization.defaultCurrency,
  ]).join(" - ")
}

export function OrganizationCombobox({
  value,
  onChange,
  placeholder,
  emptyText,
  disabled,
  className,
  triggerClassName,
  clearable = true,
  limit = DEFAULT_LIMIT,
}: OrganizationComboboxProps) {
  const messages = useCrmUiMessagesOrDefault().entityComboboxes.organization
  const [search, setSearch] = React.useState("")
  const listQuery = useOrganizations({ search: search || undefined, limit })
  const selectedQuery = useOrganization(value ?? undefined, { enabled: Boolean(value) })

  return (
    <AsyncCombobox<OrganizationRecord>
      value={value ?? null}
      onChange={onChange}
      items={listQuery.data?.data ?? []}
      selectedItem={selectedQuery.data ?? null}
      getKey={(organization) => organization.id}
      getLabel={(organization) => organization.name}
      getSecondary={formatOrganizationSecondary}
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
