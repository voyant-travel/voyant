"use client"

import { useQuery } from "@tanstack/react-query"
import { useOrganization, useOrganizations, usePeople, usePerson } from "@voyantjs/crm-react"
import { useChannel, useChannels } from "@voyantjs/distribution-react"
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
} from "@voyantjs/legal-react"
import { useSupplier, useSuppliers } from "@voyantjs/suppliers-react"
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
import { DateTimePicker } from "@voyantjs/ui/components/date-time-picker"
import { languages } from "@voyantjs/utils/languages"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { type UseFormSetValue, type UseFormWatch, useFieldArray, useForm } from "react-hook-form"
import { z } from "zod/v4"
import { zodResolver } from "@/lib/zod-resolver"
import { legalQueryClient } from "./legal-query-client"

const contractFormSchema = z.object({
  scope: z.enum(["customer", "supplier", "partner", "channel", "other"]),
  title: z.string().min(1, "Title is required"),
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

type FormValues = z.input<typeof contractFormSchema>
type FormOutput = z.output<typeof contractFormSchema>

type ContractDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  contract?: LegalContractRecord
  onSuccess: () => void
}

type ComboboxOption = {
  value: string
  label: string
  description?: string
}

type TemplateVariableRow = FormValues["templateVariables"][number]

const SCOPES = [
  { value: "customer", label: "Customer" },
  { value: "supplier", label: "Supplier" },
  { value: "partner", label: "Partner" },
  { value: "channel", label: "Channel" },
  { value: "other", label: "Other" },
] as const

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

function buildRecordFromPairs(entries: Array<{ key?: string; value?: string }>) {
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

function buildVariablesPayload(
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
        <ComboboxEmpty>{loading ? "Loading..." : emptyLabel}</ComboboxEmpty>
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
}: {
  row: TemplateVariableRow
  index: number
  setValue: UseFormSetValue<FormValues>
  watch: UseFormWatch<FormValues>
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
          <span>{watch(booleanPath) ? "Yes" : "No"}</span>
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
        placeholder={row.example || "Select date & time"}
        className="w-full"
      />
    )
  }

  if (row.type === "date") {
    return (
      <Input
        type="date"
        value={watch(valuePath) || ""}
        onChange={(event) =>
          setValue(valuePath, event.target.value, {
            shouldDirty: true,
            shouldValidate: true,
          })
        }
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
      placeholder={row.example || "Enter value"}
    />
  )
}

export function ContractDialog({ open, onOpenChange, contract, onSuccess }: ContractDialogProps) {
  const isEditing = !!contract
  const { create, update } = useLegalContractMutation()
  const { variableCatalog } = useLegalContractTemplateAuthoring()

  const [templateSearch, setTemplateSearch] = useState("")
  const [personSearch, setPersonSearch] = useState("")
  const [organizationSearch, setOrganizationSearch] = useState("")
  const [supplierSearch, setSupplierSearch] = useState("")
  const [templateId, setTemplateId] = useState<string | null>(null)
  const syncedTemplateVariablesSignatureRef = useRef("")

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(contractFormSchema),
    defaultValues: {
      scope: "customer",
      title: "",
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
        legalQueryClient,
      )
      return data
    },
  })

  const numberSeriesQuery = useLegalContractNumberSeries({ enabled: open })
  const peopleQuery = usePeople({
    search: personSearch || undefined,
    limit: 25,
    enabled: open,
  })
  const selectedPersonQuery = usePerson(selectedPersonId ?? undefined, {
    enabled: open && !!selectedPersonId,
  })
  const organizationsQuery = useOrganizations({
    search: organizationSearch || undefined,
    limit: 25,
    enabled: open,
  })
  const selectedOrganizationQuery = useOrganization(selectedOrganizationId ?? undefined, {
    enabled: open && !!selectedOrganizationId,
  })
  const suppliersQuery = useSuppliers({
    search: supplierSearch || undefined,
    limit: 25,
    enabled: open,
  })
  const selectedSupplierQuery = useSupplier(selectedSupplierId ?? "", {
    enabled: open && !!selectedSupplierId,
  })
  const channelsQuery = useChannels({ limit: 250, enabled: open })
  const selectedChannelQuery = useChannel(selectedChannelId, {
    enabled: open && !!selectedChannelId,
  })

  useEffect(() => {
    if (!open) {
      setTemplateSearch("")
      setPersonSearch("")
      setOrganizationSearch("")
      setSupplierSearch("")
      setTemplateId(null)
      syncedTemplateVariablesSignatureRef.current = ""
      return
    }

    if (contract) {
      form.reset({
        scope: contract.scope,
        title: contract.title,
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
        description: `${template.slug} · ${template.language} · ${template.scope}`,
      })) ?? []
    const selectedOption = selectedTemplateQuery.data
      ? [
          {
            value: selectedTemplateQuery.data.id,
            label: selectedTemplateQuery.data.name,
            description: `${selectedTemplateQuery.data.slug} · ${selectedTemplateQuery.data.language} · ${selectedTemplateQuery.data.scope}`,
          },
        ]
      : []
    return mergeUniqueOptions(listOptions, selectedOption)
  }, [templateListQuery.data?.data, selectedTemplateQuery.data])

  const templateVersionOptions = useMemo(() => {
    const listedOptions =
      templateVersionsQuery.data?.map((version) => ({
        value: version.id,
        label: `Version ${version.version}`,
        description: version.changelog || "Most recent draft",
      })) ?? []
    const selectedOption = selectedTemplateVersionQuery.data
      ? [
          {
            value: selectedTemplateVersionQuery.data.id,
            label: `Version ${selectedTemplateVersionQuery.data.version}`,
            description: selectedTemplateVersionQuery.data.changelog || "Selected version",
          },
        ]
      : []
    return mergeUniqueOptions(listedOptions, selectedOption)
  }, [selectedTemplateVersionQuery.data, templateVersionsQuery.data])

  const seriesOptions = useMemo(() => {
    return (
      numberSeriesQuery.data?.data
        .filter((series) => series.scope === selectedScope)
        .map((series) => ({
          value: series.id,
          label: `${series.name} · ${series.prefix}${series.separator || ""}${String(
            (series.currentSequence ?? 0) + 1,
          ).padStart(series.padLength, "0")}`,
          description: `${series.scope} · ${series.active ? "active" : "inactive"}`,
        })) ?? []
    )
  }, [numberSeriesQuery.data, selectedScope])

  const personOptions = useMemo(() => {
    const listOptions =
      peopleQuery.data?.data.map((person) => ({
        value: person.id,
        label: `${person.firstName} ${person.lastName}`.trim(),
        description: person.email || person.phone || person.id,
      })) ?? []
    const selectedOption = selectedPersonQuery.data
      ? [
          {
            value: selectedPersonQuery.data.id,
            label:
              `${selectedPersonQuery.data.firstName} ${selectedPersonQuery.data.lastName}`.trim(),
            description:
              selectedPersonQuery.data.email ||
              selectedPersonQuery.data.phone ||
              selectedPersonQuery.data.id,
          },
        ]
      : []
    return mergeUniqueOptions(listOptions, selectedOption)
  }, [peopleQuery.data?.data, selectedPersonQuery.data])

  const organizationOptions = useMemo(() => {
    const listOptions =
      organizationsQuery.data?.data.map((organization) => ({
        value: organization.id,
        label: organization.name,
        description: organization.website || organization.legalName || organization.id,
      })) ?? []
    const selectedOption = selectedOrganizationQuery.data
      ? [
          {
            value: selectedOrganizationQuery.data.id,
            label: selectedOrganizationQuery.data.name,
            description:
              selectedOrganizationQuery.data.website ??
              selectedOrganizationQuery.data.legalName ??
              selectedOrganizationQuery.data.id,
          },
        ]
      : []
    return mergeUniqueOptions(listOptions, selectedOption)
  }, [organizationsQuery.data?.data, selectedOrganizationQuery.data])

  const supplierOptions = useMemo(() => {
    const listOptions =
      suppliersQuery.data?.data.map((supplier) => ({
        value: supplier.id,
        label: supplier.name,
        description: [supplier.type, supplier.city, supplier.country].filter(Boolean).join(" · "),
      })) ?? []
    const selectedOption = selectedSupplierQuery.data
      ? [
          {
            value: selectedSupplierQuery.data.data.id,
            label: selectedSupplierQuery.data.data.name,
            description: [
              selectedSupplierQuery.data.data.type,
              selectedSupplierQuery.data.data.city,
              selectedSupplierQuery.data.data.country,
            ]
              .filter(Boolean)
              .join(" · "),
          },
        ]
      : []
    return mergeUniqueOptions(listOptions, selectedOption)
  }, [suppliersQuery.data?.data, selectedSupplierQuery.data])

  const channelOptions = useMemo(() => {
    const listOptions =
      channelsQuery.data?.data.map((channel) => ({
        value: channel.id,
        label: channel.name,
        description: [channel.kind, channel.status, channel.website].filter(Boolean).join(" · "),
      })) ?? []
    const selectedOption = selectedChannelQuery.data
      ? [
          {
            value: selectedChannelQuery.data.id,
            label: selectedChannelQuery.data.name,
            description: [
              selectedChannelQuery.data.kind,
              selectedChannelQuery.data.status,
              selectedChannelQuery.data.website,
            ]
              .filter(Boolean)
              .join(" · "),
          },
        ]
      : []
    return mergeUniqueOptions(listOptions, selectedOption)
  }, [channelsQuery.data?.data, selectedChannelQuery.data])

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
    const currentValues = new Map<string, { value?: string; booleanValue?: boolean }>()

    for (const row of existingTemplateRows) {
      currentValues.set(row.key, { value: row.value, booleanValue: row.booleanValue })
    }
    for (const row of existingAdditionalRows) {
      const key = row.key?.trim()
      if (!key) continue
      currentValues.set(key, { value: row.value })
    }

    const knownKeys = new Set(inferredTemplateVariableRows.map((row) => row.key))
    const nextTemplateRows = inferredTemplateVariableRows.map((row) => {
      const existing = currentValues.get(row.key)
      return {
        ...row,
        value: typeof existing?.value === "string" ? existing.value : "",
        booleanValue: typeof existing?.booleanValue === "boolean" ? existing.booleanValue : false,
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

  const onSubmit = async (values: FormOutput) => {
    const payload = {
      scope: values.scope,
      title: values.title,
      language: values.language || "en",
      templateVersionId: values.templateVersionId || undefined,
      seriesId: values.seriesId || undefined,
      personId: values.personId || undefined,
      organizationId: values.organizationId || undefined,
      supplierId: values.supplierId || undefined,
      channelId: values.channelId || undefined,
      expiresAt: values.expiresAt || undefined,
      variables: buildVariablesPayload(values.templateVariables, values.additionalVariables),
      metadata: buildRecordFromPairs(values.metadataEntries),
    }

    if (isEditing && contract) {
      await update.mutateAsync({ id: contract.id, input: payload })
    } else {
      await create.mutateAsync(payload)
    }
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Contract" : "New Contract"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-6">
            <div className="grid gap-4">
              <div>
                <h3 className="text-sm font-semibold">Contract setup</h3>
                <p className="text-sm text-muted-foreground">
                  Pick the contract scope, language, template, and numbering before you fill in the
                  details.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label>Scope</Label>
                  <Select
                    items={SCOPES}
                    value={selectedScope}
                    onValueChange={(value) => form.setValue("scope", value as FormValues["scope"])}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SCOPES.map((scope) => (
                        <SelectItem key={scope.value} value={scope.value}>
                          {scope.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Language</Label>
                  <SearchableSelect
                    value={selectedLanguage}
                    onChange={(value) =>
                      form.setValue("language", value ?? "en", {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    options={languageOptions}
                    placeholder="Choose a language"
                    searchPlaceholder="Search languages..."
                    emptyLabel="No languages found."
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Title</Label>
                <Input {...form.register("title")} placeholder="Contract title" />
                {form.formState.errors.title ? (
                  <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label>Template</Label>
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
                    placeholder="Choose a template"
                    searchPlaceholder="Search templates..."
                    emptyLabel="No templates found."
                    loading={templateListQuery.isPending || selectedTemplateQuery.isPending}
                    onSearchChange={setTemplateSearch}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Template version</Label>
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
                    placeholder="Choose a version"
                    searchPlaceholder="Search versions..."
                    emptyLabel={
                      templateId
                        ? "No versions found for this template."
                        : "Choose a template first."
                    }
                    loading={
                      templateVersionsQuery.isPending || selectedTemplateVersionQuery.isPending
                    }
                    disabled={!templateId}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label>Number series</Label>
                  <SearchableSelect
                    value={selectedSeriesId}
                    onChange={(value) =>
                      form.setValue("seriesId", value ?? "", {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    options={seriesOptions}
                    placeholder="Choose a number series"
                    searchPlaceholder="Search number series..."
                    emptyLabel="No number series found."
                    loading={numberSeriesQuery.isPending}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Expires at</Label>
                  <DateTimePicker
                    value={form.watch("expiresAt") || null}
                    onChange={(next) =>
                      form.setValue("expiresAt", next ?? "", {
                        shouldValidate: true,
                        shouldDirty: true,
                      })
                    }
                    placeholder="Select expiry date & time"
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <div>
                <h3 className="text-sm font-semibold">Linked records</h3>
                <p className="text-sm text-muted-foreground">
                  Link the contract to the right customer, organization, supplier, or channel so
                  your team can find it later.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label>Person</Label>
                  <SearchableSelect
                    value={selectedPersonId}
                    onChange={(value) =>
                      form.setValue("personId", value ?? "", {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    options={personOptions}
                    placeholder="Choose a person"
                    searchPlaceholder="Search people..."
                    emptyLabel="No people found."
                    loading={peopleQuery.isPending || selectedPersonQuery.isPending}
                    onSearchChange={setPersonSearch}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Organization</Label>
                  <SearchableSelect
                    value={selectedOrganizationId}
                    onChange={(value) =>
                      form.setValue("organizationId", value ?? "", {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    options={organizationOptions}
                    placeholder="Choose an organization"
                    searchPlaceholder="Search organizations..."
                    emptyLabel="No organizations found."
                    loading={organizationsQuery.isPending}
                    onSearchChange={setOrganizationSearch}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label>Supplier</Label>
                  <SearchableSelect
                    value={selectedSupplierId}
                    onChange={(value) =>
                      form.setValue("supplierId", value ?? "", {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    options={supplierOptions}
                    placeholder="Choose a supplier"
                    searchPlaceholder="Search suppliers..."
                    emptyLabel="No suppliers found."
                    loading={suppliersQuery.isPending || selectedSupplierQuery.isPending}
                    onSearchChange={setSupplierSearch}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Channel</Label>
                  <SearchableSelect
                    value={selectedChannelId}
                    onChange={(value) =>
                      form.setValue("channelId", value ?? "", {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    options={channelOptions}
                    placeholder="Choose a channel"
                    searchPlaceholder="Search channels..."
                    emptyLabel="No channels found."
                    loading={channelsQuery.isPending || selectedChannelQuery.isPending}
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <div>
                <h3 className="text-sm font-semibold">Template variables</h3>
                <p className="text-sm text-muted-foreground">
                  These fields are inferred from the selected template version so non-technical
                  users can fill the contract without touching JSON.
                </p>
              </div>

              {!selectedTemplateVersionId ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Choose a template version to load its variables.
                </div>
              ) : templateVariablesFieldArray.fields.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  No template variables were detected for this version.
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
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="grid gap-3 rounded-md border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium">Additional variables</h4>
                    <p className="text-xs text-muted-foreground">
                      Add extra key/value pairs only if this template expects custom variables.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => additionalVariablesFieldArray.append({ key: "", value: "" })}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add variable
                  </Button>
                </div>

                {additionalVariablesFieldArray.fields.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No additional variables.</div>
                ) : (
                  <div className="grid gap-3">
                    {additionalVariablesFieldArray.fields.map((field, index) => (
                      <div key={field.id} className="grid grid-cols-[1fr_1fr_auto] gap-3">
                        <Input
                          {...form.register(`additionalVariables.${index}.key`)}
                          placeholder="Variable key"
                        />
                        <Input
                          {...form.register(`additionalVariables.${index}.value`)}
                          placeholder="Value"
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
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Metadata</h3>
                  <p className="text-sm text-muted-foreground">
                    Add internal key/value notes for reporting or integrations.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => metadataEntriesFieldArray.append({ key: "", value: "" })}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add metadata
                </Button>
              </div>

              {metadataEntriesFieldArray.fields.length === 0 ? (
                <div className="text-sm text-muted-foreground">No metadata yet.</div>
              ) : (
                <div className="grid gap-3">
                  {metadataEntriesFieldArray.fields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-[1fr_1fr_auto] gap-3">
                      <Input {...form.register(`metadataEntries.${index}.key`)} placeholder="Key" />
                      <Input
                        {...form.register(`metadataEntries.${index}.value`)}
                        placeholder="Value"
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
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {isEditing ? "Save Changes" : "Create Contract"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
