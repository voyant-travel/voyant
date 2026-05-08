"use client"

import {
  type NotificationTemplateRecord,
  useNotificationTemplate,
  useNotificationTemplates,
} from "@voyantjs/notifications-react"
import { AsyncCombobox } from "@voyantjs/ui/components/async-combobox"
import * as React from "react"

export interface TemplatePickerProps {
  /** Currently selected template id (or null when nothing is picked). */
  value: string | null
  onChange: (value: string | null) => void
  /** Restrict results to templates registered for this channel. */
  channel?: NotificationTemplateRecord["channel"]
  placeholder?: string
  emptyText?: string
  disabled?: boolean
}

/**
 * Async-friendly template picker. Searches active templates by name / slug
 * filtered by the chosen channel and resolves to the template id. The
 * currently selected template is fetched separately so its label keeps
 * rendering even after the search list filters it out.
 */
export function TemplatePicker({
  value,
  onChange,
  channel,
  placeholder = "Search templates…",
  emptyText = "No templates found.",
  disabled,
}: TemplatePickerProps) {
  const [search, setSearch] = React.useState("")
  const { data } = useNotificationTemplates({
    channel,
    status: "active",
    search: search || undefined,
    limit: 20,
    offset: 0,
  })
  const { data: selected } = useNotificationTemplate(value ?? "", { enabled: Boolean(value) })

  const items = data?.data ?? []

  return (
    <AsyncCombobox<NotificationTemplateRecord>
      value={value}
      onChange={onChange}
      items={items}
      selectedItem={selected ?? null}
      getKey={(template) => template.id}
      getLabel={(template) => template.name}
      getSecondary={(template) => template.slug}
      onSearchChange={setSearch}
      placeholder={placeholder}
      emptyText={emptyText}
      disabled={disabled}
      clearable
    />
  )
}
