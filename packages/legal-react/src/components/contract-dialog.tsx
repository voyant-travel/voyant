// agent-quality: file-size exception -- owner: legal-react; existing UI surface stays co-located until a dedicated split preserves behavior and tests.
"use client"

import { useQuery } from "@tanstack/react-query"
import { formatMessage } from "@voyantjs/i18n"
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
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
import { DatePicker } from "@voyantjs/ui/components/date-picker"
import { DateTimePicker } from "@voyantjs/ui/components/date-time-picker"
import { zodResolver } from "@voyantjs/ui/lib/zod-resolver"
import { languages } from "@voyantjs/utils/languages"
import { Loader2, Plus, Trash2 } from "lucide-react"
import type { ReactNode } from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { type UseFormSetValue, type UseFormWatch, useFieldArray, useForm } from "react-hook-form"
import { z } from "zod/v4"
import { useLegalUiMessagesOrDefault } from "../i18n/index.js"
import { type LegalContractScope, legalContractScopes } from "../i18n/messages.js"
import {
  fetchWithValidation,
  type LegalContractRecord,
  legalContractTemplateVersionRecordSchema,
  singleEnvelope,
  useLegalContractMutation,
  useLegalContractNumberSeries,
  useLegalContractTemplate,
  useLegalContractTemplateAuthoring,
  useLegalContractTemplates,
  useLegalContractTemplateVersions,
  useVoyantLegalContext,
} from "../index.js"

type ContractDialogMessages = ReturnType<typeof useLegalUiMessagesOrDefault>["contractDialog"]

const contractFormSchema = z.object({
  scope: z.enum(legalContractScopes),
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
      includeBooleanValue: z.boolean().default(false),
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

type FormValues = z.input<typeof contractFormSchema>
type FormOutput = z.output<typeof contractFormSchema>
type TemplateVariableRow = FormValues["templateVariables"][number]

export interface LinkedRecordPickerProps {
  value: string | undefined
  onChange: (id: string | undefined) => void
  scope: LegalContractScope
}

export interface ContractDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contract?: LegalContractRecord
  onSuccess: () => void
  renderPersonPicker?: (props: LinkedRecordPickerProps) => ReactNode
  renderOrganizationPicker?: (props: LinkedRecordPickerProps) => ReactNode
  renderSupplierPicker?: (props: LinkedRecordPickerProps) => ReactNode
  renderChannelPicker?: (props: LinkedRecordPickerProps) => ReactNode
}

type ComboboxOption = {
  value: string
  label: string
  description?: string
}

const PREFERRED_LANGUAGE_ORDER = ["en", "ro", "fr", "de", "es", "it"] as const

const languageOptions: ComboboxOption[] = Object.entries(languages)
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

function mergeUniqueOptions(...groups: Array<ComboboxOption[] | undefined>): ComboboxOption[] {
  const map = new Map<string, ComboboxOption>()
  for (const group of groups) {
    for (const option of group ?? []) {
      map.set(option.value, option)
    }
  }
  return Array.from(map.values())
}

function objectToEntries(record: Record<string, unknown> | null | undefined) {
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

function parseLooseValue(value: string) {
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
      if (row.booleanValue || row.required || row.includeBooleanValue) {
        variables[row.key] = row.booleanValue
      }
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

export function clearedOptionalValue(value: string | undefined, isEditing: boolean) {
  const trimmed = value?.trim()
  if (trimmed) return trimmed
  return isEditing ? null : undefined
}

function parseBooleanFormValue(value: string | undefined) {
  const parsed = parseLooseValue(value ?? "")
  return typeof parsed === "boolean" ? parsed : undefined
}

function inferTemplateVariableKeys(body: string | null | undefined, requiredKeys: string[]) {
  if (!body) return new Set(requiredKeys)
  const detected = new Set(requiredKeys)
  const variablePattern = /\{\{\s*([a-zA-Z0-9_.[\]]+)\s*\}\}/g

  for (const match of body.matchAll(variablePattern)) {
    if (match[1]) detected.add(match[1])
  }

  return detected
}

function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  loadingLabel,
  loading,
  disabled,
  onSearchChange,
}: {
  value: string | null | undefined
  onChange: (value: string | null) => void
  options: ComboboxOption[]
  placeholder: string
  searchPlaceholder?: string
  emptyLabel: string
  loadingLabel: string
  loading?: boolean
  disabled?: boolean
  onSearchChange?: (value: string) => void
}) {
  const optionMap = useMemo(
    () => new Map(options.map((option) => [option.value, option])),
    [options],
  )
  const selected = value ? optionMap.get(value) : undefined
  const selectedLabel = selected?.label ?? ""
  const [inputValue, setInputValue] = useState(selectedLabel)

  useEffect(() => {
    setInputValue(selectedLabel)
  }, [selectedLabel])

  return (
    <Combobox
      items={options.map((option) => option.value)}
      value={value ?? null}
      inputValue={inputValue}
      autoHighlight
      disabled={disabled}
      itemToStringValue={(id) => optionMap.get(id as string)?.label ?? ""}
      onInputValueChange={(next) => {
        setInputValue(next)
        onSearchChange?.(next)
        if (!next) onChange(null)
      }}
      onValueChange={(next) => {
        const resolved = (next as string | null) ?? null
        onChange(resolved)
        setInputValue(resolved ? (optionMap.get(resolved)?.label ?? "") : "")
      }}
    >
      <ComboboxInput
        placeholder={searchPlaceholder ?? placeholder}
        showClear={!!value}
        disabled={disabled}
      />
      <ComboboxContent>
        <ComboboxEmpty>{loading ? loadingLabel : emptyLabel}</ComboboxEmpty>
        <ComboboxList>
          <ComboboxCollection>
            {(id) => {
              const option = optionMap.get(id as string)
              if (!option) return null
              return (
                <ComboboxItem key={option.value} value={option.value}>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{option.label}</span>
                    {option.description ? (
                      <span className="truncate text-xs text-muted-foreground">
                        {option.description}
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

function VariableValueField({
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
  const includeBooleanPath = `templateVariables.${index}.includeBooleanValue` as const

  if (row.type === "boolean") {
    return (
      <div className="flex min-h-10 items-center rounded-md border border-input px-3 text-sm">
        <div className="flex items-center gap-2">
          <Switch
            aria-label={row.label}
            checked={watch(booleanPath)}
            onCheckedChange={(checked) => {
              setValue(booleanPath, checked, {
                shouldDirty: true,
                shouldValidate: true,
              })
              setValue(includeBooleanPath, true, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }}
          />
          <span>{watch(booleanPath) ? messages.booleanYes : messages.booleanNo}</span>
        </div>
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
        placeholder={row.example || messages.dateFallbackPlaceholder}
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

function LinkedRecordField({
  label,
  value,
  scope,
  onChange,
  renderPicker,
}: {
  label: string
  value: string | null
  scope: LegalContractScope
  onChange: (id: string | undefined) => void
  renderPicker?: (props: LinkedRecordPickerProps) => ReactNode
}) {
  if (!renderPicker) return null

  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {renderPicker({
        value: value ?? undefined,
        onChange,
        scope,
      })}
    </div>
  )
}

export function ContractDialog({
  open,
  onOpenChange,
  contract,
  onSuccess,
  renderPersonPicker,
  renderOrganizationPicker,
  renderSupplierPicker,
  renderChannelPicker,
}: ContractDialogProps) {
  const isEditing = !!contract
  const messages = useLegalUiMessagesOrDefault()
  const t = messages.contractDialog
  const { baseUrl, fetcher } = useVoyantLegalContext()
  const { create, update } = useLegalContractMutation()
  const { variableCatalog } = useLegalContractTemplateAuthoring()
  const hasLinkedRecordPicker = Boolean(
    renderPersonPicker || renderOrganizationPicker || renderSupplierPicker || renderChannelPicker,
  )

  const validationByCode: Record<string, string> = {
    titleRequired: t.validation.titleRequired,
  }
  const resolveValidation = (code: string | undefined) =>
    (code && validationByCode[code]) || code || ""

  const [templateSearch, setTemplateSearch] = useState("")
  const [templateId, setTemplateId] = useState<string | null>(null)
  const syncedTemplateVariablesSignatureRef = useRef("")

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(contractFormSchema),
    defaultValues: {
      scope: "customer",
      title: "",
      contractNumber: "",
      language: "en",
      templateVersionId: "",
      seriesId: "",
      personId: "",
      organizationId: "",
      supplierId: "",
      channelId: "",
      expiresAt: "",
      templateVariables: [],
      additionalVariables: [],
      metadataEntries: [],
    },
  })

  const templateVariablesFieldArray = useFieldArray({
    control: form.control,
    name: "templateVariables",
  })
  const additionalVariablesFieldArray = useFieldArray({
    control: form.control,
    name: "additionalVariables",
  })
  const metadataEntriesFieldArray = useFieldArray({
    control: form.control,
    name: "metadataEntries",
  })

  const selectedScope = form.watch("scope")
  const selectedLanguage = form.watch("language") || "en"
  const selectedTemplateVersionId = form.watch("templateVersionId") || null
  const selectedSeriesId = form.watch("seriesId") || null
  const selectedPersonId = form.watch("personId") || null
  const selectedOrganizationId = form.watch("organizationId") || null
  const selectedSupplierId = form.watch("supplierId") || null
  const selectedChannelId = form.watch("channelId") || null

  const templateListQuery = useLegalContractTemplates({
    search: templateSearch || undefined,
    scope: selectedScope,
    limit: 25,
    offset: 0,
    enabled: open,
  })
  const selectedTemplateQuery = useLegalContractTemplate(templateId ?? "", {
    enabled: open && !!templateId,
  })
  const templateVersionsQuery = useLegalContractTemplateVersions({
    templateId: templateId ?? "",
    enabled: open && !!templateId,
  })
  const selectedTemplateVersionQuery = useQuery({
    queryKey: ["legal", "template-version", selectedTemplateVersionId],
    enabled: open && !!selectedTemplateVersionId,
    queryFn: async () => {
      const { data } = await fetchWithValidation(
        `/v1/admin/legal/contracts/template-versions/${selectedTemplateVersionId}`,
        singleEnvelope(legalContractTemplateVersionRecordSchema),
        { baseUrl, fetcher },
      )
      return data
    },
  })

  const numberSeriesQuery = useLegalContractNumberSeries({ enabled: open })

  useEffect(() => {
    if (!open) {
      setTemplateSearch("")
      setTemplateId(null)
      syncedTemplateVariablesSignatureRef.current = ""
      return
    }

    if (contract) {
      form.reset({
        scope: contract.scope,
        title: contract.title,
        contractNumber: contract.contractNumber ?? "",
        language: contract.language ?? "en",
        templateVersionId: contract.templateVersionId ?? "",
        seriesId: contract.seriesId ?? "",
        personId: contract.personId ?? "",
        organizationId: contract.organizationId ?? "",
        supplierId: contract.supplierId ?? "",
        channelId: contract.channelId ?? "",
        expiresAt: contract.expiresAt ?? "",
        templateVariables: [],
        additionalVariables: objectToEntries(contract.variables),
        metadataEntries: objectToEntries(contract.metadata),
      })
    } else {
      form.reset({
        scope: "customer",
        title: "",
        contractNumber: "",
        language: "en",
        templateVersionId: "",
        seriesId: "",
        personId: "",
        organizationId: "",
        supplierId: "",
        channelId: "",
        expiresAt: "",
        templateVariables: [],
        additionalVariables: [],
        metadataEntries: [],
      })
    }
  }, [open, contract, form])

  useEffect(() => {
    if (!open) return
    if (selectedTemplateVersionQuery.data?.templateId) {
      setTemplateId((current) => current ?? selectedTemplateVersionQuery.data?.templateId ?? null)
    }
  }, [open, selectedTemplateVersionQuery.data])

  const templateOptions = useMemo(() => {
    const listOptions =
      templateListQuery.data?.data.map((template) => ({
        value: template.id,
        label: template.name,
        description: `${template.slug} - ${template.language} - ${template.scope}`,
      })) ?? []
    const selectedOption = selectedTemplateQuery.data
      ? [
          {
            value: selectedTemplateQuery.data.id,
            label: selectedTemplateQuery.data.name,
            description: `${selectedTemplateQuery.data.slug} - ${selectedTemplateQuery.data.language} - ${selectedTemplateQuery.data.scope}`,
          },
        ]
      : []
    return mergeUniqueOptions(listOptions, selectedOption)
  }, [templateListQuery.data?.data, selectedTemplateQuery.data])

  const templateVersionOptions = useMemo(() => {
    const listedOptions =
      templateVersionsQuery.data?.map((version) => ({
        value: version.id,
        label: formatMessage(t.templateVersionLabelFormat, { version: version.version }),
        description: version.changelog || t.templateVersionMostRecentDraft,
      })) ?? []
    const selectedOption = selectedTemplateVersionQuery.data
      ? [
          {
            value: selectedTemplateVersionQuery.data.id,
            label: formatMessage(t.templateVersionLabelFormat, {
              version: selectedTemplateVersionQuery.data.version,
            }),
            description:
              selectedTemplateVersionQuery.data.changelog || t.templateVersionSelectedFallback,
          },
        ]
      : []
    return mergeUniqueOptions(listedOptions, selectedOption)
  }, [
    selectedTemplateVersionQuery.data,
    t.templateVersionLabelFormat,
    t.templateVersionMostRecentDraft,
    t.templateVersionSelectedFallback,
    templateVersionsQuery.data,
  ])

  const seriesOptions = useMemo(() => {
    return (
      numberSeriesQuery.data?.data
        .filter((series) => series.scope === selectedScope)
        .map((series) => ({
          value: series.id,
          label: `${series.name} - ${series.prefix}${series.separator || ""}${String(
            (series.currentSequence ?? 0) + 1,
          ).padStart(series.padLength, "0")}`,
          description: `${series.scope} - ${series.active ? t.seriesActive : t.seriesInactive}`,
        })) ?? []
    )
  }, [numberSeriesQuery.data, selectedScope, t.seriesActive, t.seriesInactive])

  const flattenedVariableCatalog = useMemo(() => {
    return variableCatalog.flatMap((group) =>
      group.variables.map((variable) => ({
        ...variable,
        groupLabel: group.label,
      })),
    )
  }, [variableCatalog])

  const selectedTemplateVersion = selectedTemplateVersionQuery.data
  const inferredTemplateVariableRows = useMemo(() => {
    if (!selectedTemplateVersion) return []

    const requiredKeys = Array.isArray(selectedTemplateVersion.variableSchema?.required)
      ? (selectedTemplateVersion.variableSchema.required as string[])
      : []
    const detectedKeys = inferTemplateVariableKeys(selectedTemplateVersion.body, requiredKeys)

    return flattenedVariableCatalog
      .filter((variable) => detectedKeys.has(variable.key))
      .map((variable) => ({
        key: variable.key,
        label: variable.label,
        type: variable.type,
        description: variable.description || variable.groupLabel,
        example: String(variable.example),
        required: requiredKeys.includes(variable.key),
        value: "",
        booleanValue: false,
        includeBooleanValue: false,
      }))
  }, [flattenedVariableCatalog, selectedTemplateVersion])

  const templateVariablesSignature = useMemo(
    () =>
      `${selectedTemplateVersionId ?? "none"}:${inferredTemplateVariableRows.map((row) => row.key).join("|")}`,
    [inferredTemplateVariableRows, selectedTemplateVersionId],
  )

  useEffect(() => {
    if (!open) return
    if (syncedTemplateVariablesSignatureRef.current === templateVariablesSignature) return

    const existingTemplateRows = form.getValues("templateVariables")
    const existingAdditionalRows = form.getValues("additionalVariables")
    const currentValues = new Map<
      string,
      { value?: string; booleanValue?: boolean; includeBooleanValue?: boolean }
    >()

    for (const row of existingTemplateRows) {
      currentValues.set(row.key, {
        value: row.value,
        booleanValue: row.booleanValue,
        includeBooleanValue: row.includeBooleanValue,
      })
    }
    for (const row of existingAdditionalRows) {
      const key = row.key?.trim()
      if (!key) continue
      const booleanValue = parseBooleanFormValue(row.value)
      currentValues.set(key, {
        value: row.value,
        booleanValue,
        includeBooleanValue: booleanValue !== undefined,
      })
    }

    const knownKeys = new Set(inferredTemplateVariableRows.map((row) => row.key))
    const nextTemplateRows = inferredTemplateVariableRows.map((row) => {
      const existing = currentValues.get(row.key)
      return {
        ...row,
        value: typeof existing?.value === "string" ? existing.value : "",
        booleanValue: typeof existing?.booleanValue === "boolean" ? existing.booleanValue : false,
        includeBooleanValue: row.required || existing?.includeBooleanValue === true,
      }
    })

    const nextAdditionalRows = [
      ...existingAdditionalRows.filter((row) => {
        const key = row.key?.trim()
        return key && !knownKeys.has(key)
      }),
      ...existingTemplateRows
        .filter((row) => !knownKeys.has(row.key))
        .map((row) => ({
          key: row.key,
          value: row.type === "boolean" ? String(row.booleanValue) : row.value,
        })),
    ]

    templateVariablesFieldArray.replace(nextTemplateRows)
    additionalVariablesFieldArray.replace(
      nextAdditionalRows.filter(
        (row, index, rows) =>
          rows.findIndex(
            (candidate) => candidate.key === row.key && candidate.value === row.value,
          ) === index,
      ),
    )
    syncedTemplateVariablesSignatureRef.current = templateVariablesSignature
  }, [
    additionalVariablesFieldArray,
    form,
    inferredTemplateVariableRows,
    open,
    templateVariablesSignature,
    templateVariablesFieldArray,
  ])

  const setLinkedRecordField = (
    field: "personId" | "organizationId" | "supplierId" | "channelId",
    value: string | undefined,
  ) =>
    form.setValue(field, value ?? "", {
      shouldDirty: true,
      shouldValidate: true,
    })

  const onSubmit = async (values: FormOutput) => {
    const variables = buildVariablesPayload(values.templateVariables, values.additionalVariables)
    const metadata = buildRecordFromPairs(values.metadataEntries)
    const payload = {
      scope: values.scope,
      title: values.title,
      contractNumber: values.contractNumber?.trim() || null,
      language: values.language || "en",
      templateVersionId: clearedOptionalValue(values.templateVersionId, isEditing),
      seriesId: clearedOptionalValue(values.seriesId, isEditing),
      personId: clearedOptionalValue(values.personId, isEditing),
      organizationId: clearedOptionalValue(values.organizationId, isEditing),
      supplierId: clearedOptionalValue(values.supplierId, isEditing),
      channelId: clearedOptionalValue(values.channelId, isEditing),
      expiresAt: clearedOptionalValue(values.expiresAt, isEditing),
      variables: variables ?? (isEditing ? null : undefined),
      metadata: metadata ?? (isEditing ? null : undefined),
    }

    if (isEditing && contract) {
      await update.mutateAsync({ id: contract.id, input: payload })
    } else {
      await create.mutateAsync(payload)
    }
    onSuccess()
  }

  const isSubmitting = form.formState.isSubmitting || create.isPending || update.isPending
  const submitError = create.error ?? update.error ?? null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" className="h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)]">
        <DialogHeader>
          <DialogTitle>{isEditing ? t.titleEdit : t.titleNew}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <DialogBody className="grid gap-6">
            <div className="grid gap-4">
              <div>
                <h3 className="text-sm font-semibold">{t.setupSectionTitle}</h3>
                <p className="text-sm text-muted-foreground">{t.setupSectionDescription}</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>{t.scopeLabel}</Label>
                  <Select
                    items={legalContractScopes.map((value) => ({
                      value,
                      label: messages.common.contractScopeLabels[value],
                    }))}
                    value={selectedScope}
                    onValueChange={(value) =>
                      form.setValue("scope", value as FormValues["scope"], {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {legalContractScopes.map((value) => (
                        <SelectItem key={value} value={value}>
                          {messages.common.contractScopeLabels[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label>{t.languageLabel}</Label>
                  <SearchableSelect
                    value={selectedLanguage}
                    onChange={(value) =>
                      form.setValue("language", value ?? "en", {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    options={languageOptions}
                    placeholder={t.languagePlaceholder}
                    searchPlaceholder={t.languageSearchPlaceholder}
                    emptyLabel={t.languageEmpty}
                    loadingLabel={t.loading}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label>{t.titleLabel}</Label>
                <Input {...form.register("title")} placeholder={t.titlePlaceholder} />
                {form.formState.errors.title ? (
                  <p className="text-xs text-destructive">
                    {resolveValidation(form.formState.errors.title.message)}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>{t.contractNumberLabel}</Label>
                  <Input
                    {...form.register("contractNumber")}
                    placeholder={t.contractNumberPlaceholder}
                    maxLength={100}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label>{t.expiresAtLabel}</Label>
                  <DateTimePicker
                    value={form.watch("expiresAt") || null}
                    onChange={(next) =>
                      form.setValue("expiresAt", next ?? "", {
                        shouldValidate: true,
                        shouldDirty: true,
                      })
                    }
                    placeholder={t.expiresAtPlaceholder}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>{t.templateLabel}</Label>
                  <SearchableSelect
                    value={templateId}
                    onChange={(value) => {
                      setTemplateId(value)
                      form.setValue("templateVersionId", "", {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                      syncedTemplateVariablesSignatureRef.current = ""
                    }}
                    options={templateOptions}
                    placeholder={t.templatePlaceholder}
                    searchPlaceholder={t.templateSearchPlaceholder}
                    emptyLabel={t.templateEmpty}
                    loading={templateListQuery.isPending || selectedTemplateQuery.isPending}
                    onSearchChange={setTemplateSearch}
                    loadingLabel={t.loading}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label>{t.templateVersionLabel}</Label>
                  <SearchableSelect
                    value={selectedTemplateVersionId}
                    onChange={(value) => {
                      form.setValue("templateVersionId", value ?? "", {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                      syncedTemplateVariablesSignatureRef.current = ""
                    }}
                    options={templateVersionOptions}
                    placeholder={t.templateVersionPlaceholder}
                    searchPlaceholder={t.templateVersionSearchPlaceholder}
                    emptyLabel={
                      templateId ? t.templateVersionEmpty : t.templateVersionPickTemplateFirst
                    }
                    loading={
                      templateVersionsQuery.isPending || selectedTemplateVersionQuery.isPending
                    }
                    disabled={!templateId}
                    loadingLabel={t.loading}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label>{t.numberSeriesLabel}</Label>
                <SearchableSelect
                  value={selectedSeriesId}
                  onChange={(value) =>
                    form.setValue("seriesId", value ?? "", {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  options={seriesOptions}
                  placeholder={t.numberSeriesPlaceholder}
                  searchPlaceholder={t.numberSeriesSearchPlaceholder}
                  emptyLabel={t.numberSeriesEmpty}
                  loading={numberSeriesQuery.isPending}
                  loadingLabel={t.loading}
                />
              </div>
            </div>

            {hasLinkedRecordPicker ? (
              <div className="grid gap-4">
                <div>
                  <h3 className="text-sm font-semibold">{t.linkedSectionTitle}</h3>
                  <p className="text-sm text-muted-foreground">{t.linkedSectionDescription}</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <LinkedRecordField
                    label={t.personLabel}
                    value={selectedPersonId}
                    scope={selectedScope}
                    onChange={(value) => setLinkedRecordField("personId", value)}
                    renderPicker={renderPersonPicker}
                  />
                  <LinkedRecordField
                    label={t.organizationLabel}
                    value={selectedOrganizationId}
                    scope={selectedScope}
                    onChange={(value) => setLinkedRecordField("organizationId", value)}
                    renderPicker={renderOrganizationPicker}
                  />
                  <LinkedRecordField
                    label={t.supplierLabel}
                    value={selectedSupplierId}
                    scope={selectedScope}
                    onChange={(value) => setLinkedRecordField("supplierId", value)}
                    renderPicker={renderSupplierPicker}
                  />
                  <LinkedRecordField
                    label={t.channelLabel}
                    value={selectedChannelId}
                    scope={selectedScope}
                    onChange={(value) => setLinkedRecordField("channelId", value)}
                    renderPicker={renderChannelPicker}
                  />
                </div>
              </div>
            ) : null}

            <div className="grid gap-4">
              <h3 className="text-sm font-semibold">{t.templateVariablesSectionTitle}</h3>

              {!selectedTemplateVersionId ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  {t.templateVariablesNoVersion}
                </div>
              ) : templateVariablesFieldArray.fields.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  {t.templateVariablesNoneDetected}
                </div>
              ) : (
                <div className="grid gap-4">
                  {templateVariablesFieldArray.fields.map((field, index) => (
                    <div key={field.id} className="grid gap-2 rounded-md border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium">
                            {field.label}
                            {field.required ? (
                              <span className="ml-1 text-destructive">*</span>
                            ) : null}
                          </div>
                          <div className="font-mono text-xs text-muted-foreground">{field.key}</div>
                        </div>
                        {field.description ? (
                          <div className="max-w-sm text-right text-xs text-muted-foreground">
                            {field.description}
                          </div>
                        ) : null}
                      </div>
                      <VariableValueField
                        row={field as TemplateVariableRow}
                        index={index}
                        setValue={form.setValue}
                        watch={form.watch}
                        messages={t}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="grid gap-3 rounded-md border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-medium">{t.additionalVariablesTitle}</h4>
                    <p className="text-xs text-muted-foreground">
                      {t.additionalVariablesDescription}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => additionalVariablesFieldArray.append({ key: "", value: "" })}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {t.addVariable}
                  </Button>
                </div>

                {additionalVariablesFieldArray.fields.length === 0 ? (
                  <div className="text-sm text-muted-foreground">{t.additionalVariablesEmpty}</div>
                ) : (
                  <div className="grid gap-3">
                    {additionalVariablesFieldArray.fields.map((field, index) => (
                      <div key={field.id} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                        <Input
                          {...form.register(`additionalVariables.${index}.key`)}
                          placeholder={t.variableKeyPlaceholder}
                        />
                        <Input
                          {...form.register(`additionalVariables.${index}.value`)}
                          placeholder={t.variableValuePlaceholder}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => additionalVariablesFieldArray.remove(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-3 rounded-md border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">{t.metadataSectionTitle}</h3>
                  <p className="text-sm text-muted-foreground">{t.metadataSectionDescription}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => metadataEntriesFieldArray.append({ key: "", value: "" })}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t.addMetadata}
                </Button>
              </div>

              {metadataEntriesFieldArray.fields.length === 0 ? (
                <div className="text-sm text-muted-foreground">{t.metadataEmpty}</div>
              ) : (
                <div className="grid gap-3">
                  {metadataEntriesFieldArray.fields.map((field, index) => (
                    <div key={field.id} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                      <Input
                        {...form.register(`metadataEntries.${index}.key`)}
                        placeholder={t.metadataKeyPlaceholder}
                      />
                      <Input
                        {...form.register(`metadataEntries.${index}.value`)}
                        placeholder={t.metadataValuePlaceholder}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => metadataEntriesFieldArray.remove(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {submitError ? <p className="text-xs text-destructive">{submitError.message}</p> : null}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditing ? messages.common.saveChanges : t.createAction}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
