"use client"

import { type Supplier, useSupplier, useSuppliers } from "@voyantjs/suppliers-react"
import { AsyncCombobox } from "@voyantjs/ui/components/async-combobox"
import * as React from "react"

import { useSuppliersUiMessagesOrDefault } from "../i18n/index.js"

export interface SupplierComboboxProps {
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

function formatSupplierSecondary(supplier: Supplier) {
  return compact([supplier.city, supplier.country, supplier.defaultCurrency]).join(" - ")
}

export function SupplierCombobox({
  value,
  onChange,
  placeholder,
  emptyText,
  disabled,
  className,
  triggerClassName,
  clearable = true,
  limit = DEFAULT_LIMIT,
}: SupplierComboboxProps) {
  const messages = useSuppliersUiMessagesOrDefault()
  const comboboxMessages = messages.supplierCombobox
  const [search, setSearch] = React.useState("")
  const listQuery = useSuppliers({ search: search || undefined, limit })
  const selectedQuery = useSupplier(value ?? "", { enabled: Boolean(value) })

  return (
    <AsyncCombobox<Supplier>
      value={value ?? null}
      onChange={onChange}
      items={listQuery.data?.data ?? []}
      selectedItem={selectedQuery.data?.data ?? null}
      getKey={(supplier) => supplier.id}
      getLabel={(supplier) => supplier.name}
      getSecondary={formatSupplierSecondary}
      onSearchChange={setSearch}
      placeholder={placeholder ?? comboboxMessages.placeholder}
      emptyText={
        listQuery.isPending || selectedQuery.isPending
          ? comboboxMessages.loading
          : (emptyText ?? comboboxMessages.empty)
      }
      disabled={disabled}
      className={className}
      triggerClassName={triggerClassName}
      clearable={clearable}
    />
  )
}
