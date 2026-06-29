"use client"

import type { useOperatorAdminMessages } from "@voyant-travel/admin"
import { DatePicker, Input } from "@voyant-travel/ui/components"
import { DateTimePicker } from "@voyant-travel/ui/components/date-time-picker"
import { languages } from "@voyant-travel/utils/languages"
import type { UseFormSetValue, UseFormWatch } from "react-hook-form"
import { z } from "zod/v4"

import type { LegalContractRecord } from "../index.js"
import type { ComboboxOption } from "./legal-admin-shared.js"

type ContractDialogMessages = ReturnType<typeof useOperatorAdminMessages>["legal"]["contractDialog"]

export const contractFormSchema = z.object({
  scope: z.enum(["customer", "supplier", "partner", "channel", "other"]),
  title: z.string().min(1, "titleRequired"),
  contractNumber: z.string().optional(),
  language: z.string().min(2).max(10).optional(),
  templateVersionId: z.string().optional(),
  seriesId: z.string().optional(),
  personId: z.string().optional(),
  organizationId: z.string().optional(),
  supplierId: z.string().optional(),
  channelId: z.string().optional(),
  expiresAt: z.string().optional(),
  templateVariables: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      type: z.string(),
      description: z.string().optional(),
      example: z.string().optional(),
      required: z.boolean().default(false),
      value: z.string().optional(),
      booleanValue: z.boolean().default(false),
    }),
  ),
  additionalVariables: z.array(
    z.object({
      key: z.string().optional(),
      value: z.string().optional(),
    }),
  ),
  metadataEntries: z.array(
    z.object({
      key: z.string().optional(),
      value: z.string().optional(),
    }),
  ),
})

export type FormValues = z.input<typeof contractFormSchema>
export type FormOutput = z.output<typeof contractFormSchema>

export interface ContractDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contract?: LegalContractRecord
  onSuccess: () => void
}

export type TemplateVariableRow = FormValues["templateVariables"][number]

export const SCOPE_VALUES = ["customer", "supplier", "partner", "channel", "other"] as const
export type ContractScopeKey = (typeof SCOPE_VALUES)[number]

const PREFERRED_LANGUAGE_ORDER = ["en", "ro", "fr", "de", "es", "it"] as const

export const languageOptions: ComboboxOption[] = Object.entries(languages)
  .sort(([codeA, nameA], [codeB, nameB]) => {
    const preferredA = PREFERRED_LANGUAGE_ORDER.indexOf(
      codeA as (typeof PREFERRED_LANGUAGE_ORDER)[number],
    )
    const preferredB = PREFERRED_LANGUAGE_ORDER.indexOf(
      codeB as (typeof PREFERRED_LANGUAGE_ORDER)[number],
    )
    if (preferredA !== -1 || preferredB !== -1) {
      if (preferredA === -1) return 1
      if (preferredB === -1) return -1
      return preferredA - preferredB
    }
    return nameA.localeCompare(nameB)
  })
  .map(([code, name]) => ({
    value: code,
    label: `${name} (${code})`,
    description: code,
  }))

export function objectToEntries(record: Record<string, unknown> | null | undefined) {
  return Object.entries(record ?? {}).map(([key, value]) => ({
    key,
    value:
      typeof value === "string"
        ? value
        : typeof value === "number" || typeof value === "boolean"
          ? String(value)
          : JSON.stringify(value),
  }))
}

export function parseLooseValue(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (trimmed === "true") return true
  if (trimmed === "false") return false
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed)
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      return JSON.parse(trimmed)
    } catch {
      return trimmed
    }
  }
  return trimmed
}

export function buildRecordFromPairs(entries: Array<{ key?: string; value?: string }>) {
  const record: Record<string, unknown> = {}
  for (const entry of entries) {
    const key = entry.key?.trim()
    if (!key) continue
    const parsed = parseLooseValue(entry.value ?? "")
    if (parsed === undefined) continue
    record[key] = parsed
  }
  return Object.keys(record).length ? record : undefined
}

export function buildVariablesPayload(
  rows: TemplateVariableRow[],
  additional: Array<{ key?: string; value?: string }>,
) {
  const variables: Record<string, unknown> = {}

  for (const row of rows) {
    if (row.type === "boolean") {
      if (row.booleanValue) variables[row.key] = true
      else if (row.required) variables[row.key] = false
      continue
    }

    const parsed = parseLooseValue(row.value ?? "")
    if (parsed !== undefined) variables[row.key] = parsed
  }

  for (const entry of additional) {
    const key = entry.key?.trim()
    if (!key) continue
    const parsed = parseLooseValue(entry.value ?? "")
    if (parsed !== undefined) variables[key] = parsed
  }

  return Object.keys(variables).length ? variables : undefined
}

export function formatUploadSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function inferTemplateVariableKeys(body: string | null | undefined, requiredKeys: string[]) {
  if (!body) return new Set(requiredKeys)
  const detected = new Set(requiredKeys)
  const variablePattern = /\{\{\s*([a-zA-Z0-9_.[\]]+)\s*\}\}/g

  for (const match of body.matchAll(variablePattern)) {
    if (match[1]) detected.add(match[1])
  }

  return detected
}

export function VariableValueField({
  row,
  index,
  setValue,
  watch,
  messages,
}: {
  row: TemplateVariableRow
  index: number
  setValue: UseFormSetValue<FormValues>
  watch: UseFormWatch<FormValues>
  messages: ContractDialogMessages
}) {
  const valuePath = `templateVariables.${index}.value` as const
  const booleanPath = `templateVariables.${index}.booleanValue` as const

  if (row.type === "boolean") {
    return (
      <div className="flex min-h-10 items-center rounded-md border border-input px-3 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={watch(booleanPath)}
            onChange={(event) =>
              setValue(booleanPath, event.target.checked, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
          />
          <span>{watch(booleanPath) ? messages.booleanYes : messages.booleanNo}</span>
        </label>
      </div>
    )
  }

  if (row.type === "datetime") {
    return (
      <DateTimePicker
        value={watch(valuePath) || null}
        onChange={(next) =>
          setValue(valuePath, next ?? "", {
            shouldDirty: true,
            shouldValidate: true,
          })
        }
        placeholder={row.example || messages.datetimeFallbackPlaceholder}
        className="w-full"
      />
    )
  }

  if (row.type === "date") {
    return (
      <DatePicker
        value={watch(valuePath) || null}
        onChange={(next) =>
          setValue(valuePath, next ?? "", {
            shouldDirty: true,
            shouldValidate: true,
          })
        }
        className="w-full"
      />
    )
  }

  const inputType =
    row.type === "email"
      ? "email"
      : row.type === "url"
        ? "url"
        : row.type === "phone"
          ? "tel"
          : row.type === "number"
            ? "number"
            : "text"

  return (
    <Input
      type={inputType}
      step={row.type === "number" ? "1" : undefined}
      value={watch(valuePath) || ""}
      onChange={(event) =>
        setValue(valuePath, event.target.value, {
          shouldDirty: true,
          shouldValidate: true,
        })
      }
      placeholder={row.example || messages.valueFallbackPlaceholder}
    />
  )
}
