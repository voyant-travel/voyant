"use client"

import type { customFieldTypeSchema } from "@voyant-travel/custom-fields/contracts"
import { normalizeCustomFieldVisibility } from "@voyant-travel/custom-fields/target-capabilities"
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Switch,
} from "@voyant-travel/ui/components"
import { Loader2, Plus, Trash2 } from "lucide-react"
import type { FormEvent } from "react"
import { useEffect, useMemo, useState } from "react"
import type { z } from "zod"
import {
  type CreateCustomFieldDefinitionInput,
  type UpdateCustomFieldDefinitionInput,
  useCustomFieldDefinitionMutation,
} from "../hooks/use-custom-field-definition-mutation.js"
import { useCustomFieldsUiI18nOrDefault } from "../i18n/index.js"
import type { CustomFieldsUiMessages } from "../i18n/messages.js"
import type { CustomFieldDefinitionRecord, CustomFieldTargetRecord } from "../schemas.js"

export type CustomFieldTarget = CustomFieldTargetRecord
type FieldType = z.infer<typeof customFieldTypeSchema>

type OptionRow = {
  rowKey: string
  label: string
  value: string
}

type FormValues = {
  entityType: string
  fieldType: FieldType
  key: string
  label: string
  isSearchable: boolean
  isExportable: boolean
  isInvoiceable: boolean
  options: OptionRow[]
}

type FormErrors = Partial<Record<"key" | "label" | "options", string>>

let optionSeq = 0
const nextOptionKey = () => `custom-field-option-${++optionSeq}`

export function normalizeCustomFieldDefinitionFormValues(
  target: CustomFieldTarget | undefined,
  values: Pick<FormValues, "isSearchable" | "isExportable" | "isInvoiceable">,
) {
  const visibility = normalizeCustomFieldVisibility(target, values)
  return {
    isSearchable: visibility.isSearchable ?? false,
    isExportable: visibility.isExportable ?? false,
    isInvoiceable: visibility.isInvoiceable ?? false,
  }
}

export const defaultFormValues = (target?: CustomFieldTarget): FormValues => ({
  entityType: target?.id ?? "",
  fieldType: (target?.fieldTypes[0] as FieldType | undefined) ?? "text",
  key: "",
  label: "",
  ...normalizeCustomFieldDefinitionFormValues(target, {
    isSearchable: false,
    isExportable: true,
    isInvoiceable: false,
  }),
  options: [],
})

export function getCustomFieldTypeLabels(messages: CustomFieldsUiMessages): Record<string, string> {
  return messages.sheet.fieldTypeLabels
}

export function CustomFieldDefinitionSheet({
  open,
  onOpenChange,
  definition,
  targets,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  definition?: CustomFieldDefinitionRecord
  targets: readonly CustomFieldTarget[]
  onSuccess: () => void
}) {
  const { messages } = useCustomFieldsUiI18nOrDefault()
  const isEditing = Boolean(definition)
  const { create, update } = useCustomFieldDefinitionMutation()
  const [values, setValues] = useState<FormValues>(() => defaultFormValues(targets[0]))
  const [errors, setErrors] = useState<FormErrors>({})
  const entityLabels = useMemo(
    () => Object.fromEntries(targets.map((target) => [target.id, target.label])),
    [targets],
  )

  useEffect(() => {
    if (!open) return
    setErrors({})

    if (!definition) {
      setValues(defaultFormValues(targets[0]))
      return
    }

    const target = targets.find((candidate) => candidate.id === definition.entityType)
    setValues({
      entityType: definition.entityType,
      fieldType: definition.fieldType as FieldType,
      key: definition.key,
      label: definition.label,
      ...normalizeCustomFieldDefinitionFormValues(target, definition),
      options: definition.options?.map((option) => ({ ...option, rowKey: nextOptionKey() })) ?? [],
    })
  }, [definition, open, targets])

  const supportsOptions = values.fieldType === "enum" || values.fieldType === "set"
  const isSubmitting = create.isPending || update.isPending
  const entityItems = useMemo(
    () => targets.map(({ id, label }) => ({ value: id, label })),
    [targets],
  )
  const fieldTypeLabels = getCustomFieldTypeLabels(messages)
  const fieldTypeItems = useMemo(
    () =>
      (targets.find((target) => target.id === values.entityType)?.fieldTypes ?? []).map(
        (value) => ({ value, label: fieldTypeLabels[value] ?? value }),
      ),
    [fieldTypeLabels, targets, values.entityType],
  )
  const selectedCapabilities = new Set(
    targets.find((target) => target.id === values.entityType)?.capabilities ?? [],
  )

  const setValue = <TKey extends keyof FormValues>(key: TKey, value: FormValues[TKey]) =>
    setValues((current) => ({ ...current, [key]: value }))

  const updateOption = (rowKey: string, patch: Partial<OptionRow>) =>
    setValue(
      "options",
      values.options.map((option) => (option.rowKey === rowKey ? { ...option, ...patch } : option)),
    )

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors = validateForm(values, supportsOptions, messages)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const options = supportsOptions
      ? values.options.map((option) => ({
          label: option.label.trim(),
          value: option.value.trim(),
        }))
      : null
    const visibility = normalizeCustomFieldDefinitionFormValues(
      targets.find((target) => target.id === values.entityType),
      values,
    )

    if (isEditing && definition) {
      const payload: UpdateCustomFieldDefinitionInput = {
        label: values.label.trim(),
        ...visibility,
        options,
      }
      await update.mutateAsync({ id: definition.id, input: payload })
    } else {
      const payload: CreateCustomFieldDefinitionInput = {
        entityType: values.entityType,
        fieldType: values.fieldType,
        key: values.key.trim(),
        label: values.label.trim(),
        isRequired: false,
        ...visibility,
        options,
      }
      await create.mutateAsync(payload)
    }

    onSuccess()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="lg">
        <SheetHeader>
          <SheetTitle>{isEditing ? messages.sheet.editTitle : messages.sheet.newTitle}</SheetTitle>
        </SheetHeader>
        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <SheetBody className="grid gap-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>{messages.sheet.entity}</Label>
                {isEditing ? (
                  <ReadOnlyPill>
                    {entityLabels[values.entityType] ?? values.entityType}
                  </ReadOnlyPill>
                ) : (
                  <Select
                    items={entityItems}
                    value={values.entityType}
                    onValueChange={(value) => {
                      const entityType = value ?? targets[0]?.id ?? ""
                      const fieldType =
                        targets.find((target) => target.id === entityType)?.fieldTypes[0] ?? "text"
                      setValues((current) => ({
                        ...current,
                        entityType,
                        fieldType: fieldType as FieldType,
                        ...normalizeCustomFieldDefinitionFormValues(
                          targets.find((target) => target.id === entityType),
                          current,
                        ),
                      }))
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {entityItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label>{messages.sheet.fieldType}</Label>
                {isEditing ? (
                  <ReadOnlyPill>
                    {fieldTypeLabels[values.fieldType] ?? values.fieldType}
                  </ReadOnlyPill>
                ) : (
                  <Select
                    items={fieldTypeItems}
                    value={values.fieldType}
                    onValueChange={(value) => setValue("fieldType", value as FieldType)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fieldTypeItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="custom-field-label">{messages.sheet.label}</Label>
                <Input
                  id="custom-field-label"
                  value={values.label}
                  onChange={(event) => setValue("label", event.target.value)}
                  placeholder={messages.sheet.labelPlaceholder}
                  autoFocus
                />
                {errors.label ? <p className="text-xs text-destructive">{errors.label}</p> : null}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="custom-field-key">{messages.sheet.key}</Label>
                <Input
                  id="custom-field-key"
                  value={values.key}
                  onChange={(event) => setValue("key", event.target.value)}
                  placeholder={messages.sheet.keyPlaceholder}
                  className="font-mono"
                  disabled={isEditing}
                />
                {errors.key ? <p className="text-xs text-destructive">{errors.key}</p> : null}
              </div>
            </div>

            <div className="grid gap-3 rounded-md border p-4">
              <ToggleRow
                label={messages.sheet.searchable}
                description={messages.sheet.searchableDescription}
                checked={values.isSearchable}
                disabled={!selectedCapabilities.has("search")}
                onCheckedChange={(checked) => setValue("isSearchable", checked)}
              />
              <ToggleRow
                label={messages.sheet.exportable}
                description={messages.sheet.exportableDescription}
                checked={values.isExportable}
                disabled={!selectedCapabilities.has("export")}
                onCheckedChange={(checked) => setValue("isExportable", checked)}
              />
              <ToggleRow
                label={messages.sheet.invoiceable}
                description={messages.sheet.invoiceableDescription}
                checked={values.isInvoiceable}
                disabled={!selectedCapabilities.has("invoice")}
                onCheckedChange={(checked) => setValue("isInvoiceable", checked)}
              />
            </div>

            {supportsOptions ? (
              <div className="grid gap-3">
                <div>
                  <Label>{messages.sheet.options}</Label>
                  <p className="text-xs text-muted-foreground">
                    {messages.sheet.optionsDescription}
                  </p>
                </div>
                <div className="grid gap-2">
                  {values.options.map((option) => (
                    <div key={option.rowKey} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                      <Input
                        value={option.label}
                        onChange={(event) =>
                          updateOption(option.rowKey, { label: event.target.value })
                        }
                        placeholder={messages.sheet.optionLabelPlaceholder}
                      />
                      <Input
                        value={option.value}
                        onChange={(event) =>
                          updateOption(option.rowKey, { value: event.target.value })
                        }
                        placeholder={messages.sheet.optionValuePlaceholder}
                        className="font-mono"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-9 text-muted-foreground"
                        onClick={() =>
                          setValue(
                            "options",
                            values.options.filter((row) => row.rowKey !== option.rowKey),
                          )
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                {errors.options ? (
                  <p className="text-xs text-destructive">{errors.options}</p>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  onClick={() =>
                    setValue("options", [
                      ...values.options,
                      { rowKey: nextOptionKey(), label: "", value: "" },
                    ])
                  }
                >
                  <Plus className="mr-1.5 size-3.5" />
                  {messages.sheet.addOption}
                </Button>
              </div>
            ) : null}
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              {messages.sheet.cancel}
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {isEditing ? messages.sheet.saveChanges : messages.sheet.createField}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  disabled = false,
  onCheckedChange,
}: {
  label: string
  description: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <Label>{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  )
}

function ReadOnlyPill({ children }: { children: string }) {
  return (
    <div className="flex h-9 items-center rounded-sm border bg-muted/40 px-3 text-sm text-muted-foreground">
      {children}
    </div>
  )
}

function validateForm(
  values: FormValues,
  supportsOptions: boolean,
  messages: CustomFieldsUiMessages,
): FormErrors {
  const errors: FormErrors = {}
  if (!values.label.trim()) errors.label = messages.sheet.labelRequired
  if (!values.key.trim()) errors.key = messages.sheet.keyRequired

  if (supportsOptions) {
    const validOptions = values.options.filter(
      (option) => option.label.trim() && option.value.trim(),
    )
    if (validOptions.length !== values.options.length || validOptions.length === 0) {
      errors.options = messages.sheet.optionsRequired
    }
  }

  return errors
}
