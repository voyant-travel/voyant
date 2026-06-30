"use client"

import { AsyncCombobox } from "@voyant-travel/ui/components/async-combobox"
import * as React from "react"
import { useNotificationsUiMessagesOrDefault } from "../i18n/index.js"
import {
  type NotificationTemplateRecord,
  useNotificationTemplate,
  useNotificationTemplates,
} from "../index.js"

export interface TemplatePickerProps {
  /** Currently selected template key (or null when nothing is picked). */
  value: string | null
  onChange: (value: string | null) => void
  /** Which stable template field should be emitted as the picker value. */
  valueKey?: "id" | "slug"
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
  valueKey = "id",
  channel,
  placeholder,
  emptyText,
  disabled,
}: TemplatePickerProps) {
  const messages = useNotificationsUiMessagesOrDefault().pickers.templates
  const [search, setSearch] = React.useState("")
  const { data } = useNotificationTemplates({
    channel,
    status: "active",
    search: search || undefined,
    limit: 20,
    offset: 0,
  })
  const selectedId = valueKey === "id" ? value : null
  const { data: selectedById } = useNotificationTemplate(selectedId ?? "", {
    enabled: Boolean(selectedId),
  })
  const selectedSlug = valueKey === "slug" ? value : null
  const { data: selectedBySlugList } = useNotificationTemplates({
    channel,
    status: "active",
    search: selectedSlug ?? undefined,
    limit: 1,
    offset: 0,
    enabled: Boolean(selectedSlug),
  })

  const items = data?.data ?? []
  const selectedBySlug = selectedBySlugList?.data.find((template) => template.slug === selectedSlug)
  const selected =
    selectedById ??
    selectedBySlug ??
    (valueKey === "slug" ? items.find((template) => template.slug === value) : null)
  const getKey = React.useCallback(
    (template: NotificationTemplateRecord) => (valueKey === "slug" ? template.slug : template.id),
    [valueKey],
  )

  return (
    <AsyncCombobox<NotificationTemplateRecord>
      value={value}
      onChange={onChange}
      items={items}
      selectedItem={selected ?? null}
      getKey={getKey}
      getLabel={(template) => template.name}
      getSecondary={(template) => template.slug}
      onSearchChange={setSearch}
      placeholder={placeholder ?? messages.placeholder}
      emptyText={emptyText ?? messages.empty}
      disabled={disabled}
      clearable
    />
  )
}
