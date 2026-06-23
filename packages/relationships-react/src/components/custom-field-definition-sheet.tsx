"use client"

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
import {
  type CreateCustomFieldDefinitionInput,
  type UpdateCustomFieldDefinitionInput,
  useCustomFieldDefinitionMutation,
} from "../hooks/use-custom-field-definition-mutation.js"
import { useCrmUiMessagesOrDefault } from "../i18n/index.js"
import type { CustomFieldDefinitionRecord } from "../schemas.js"

export const entityTypes = ["organization", "person", "quote", "activity"] as const
const fieldTypes = [
  "varchar",
  "text",
  "double",
  "monetary",
  "date",
  "boolean",
  "enum",
  "set",
  "json",
  "address",
  "phone",
] as const

export type EntityType = (typeof entityTypes)[number]
type FieldType = (typeof fieldTypes)[number]

type OptionRow = {
  rowKey: string
  label: string
  value: string
}

type FormValues = {
  entityType: EntityType
  fieldType: FieldType
  key: string
  label: string
  isRequired: boolean
  isSearchable: boolean
  options: OptionRow[]
}

type FormErrors = Partial<Record<"key" | "label" | "options", string>>

let optionSeq = 0
const nextOptionKey = () => `custom-field-option-${++optionSeq}`

const defaultFormValues: FormValues = {
  entityType: "person",
  fieldType: "text",
  key: "",
  label: "",
  isRequired: false,
  isSearchable: false,
  options: [],
}

export const fieldTypeLabels: Record<FieldType, string> = {
  varchar: "Short text",
  text: "Long text",
  double: "Number",
  monetary: "Money",
  date: "Date",
  boolean: "Yes/no",
  enum: "Single choice",
  set: "Multiple choice",
  json: "JSON",
  address: "Address",
  phone: "Phone",
}

export function CustomFieldDefinitionSheet({
  open,
  onOpenChange,
  definition,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  definition?: CustomFieldDefinitionRecord
  onSuccess: () => void
}) {
  const messages = useCrmUiMessagesOrDefault()
  const isEditing = Boolean(definition)
  const { create, update } = useCustomFieldDefinitionMutation()
  const [values, setValues] = useState<FormValues>(defaultFormValues)
  const [errors, setErrors] = useState<FormErrors>({})
  const entityLabels = messages.common.entityTypeLabels

  useEffect(() => {
    if (!open) return
    setErrors({})

    if (!definition) {
      setValues(defaultFormValues)
      return
    }

    setValues({
      entityType: definition.entityType,
      fieldType: definition.fieldType,
      key: definition.key,
      label: definition.label,
      isRequired: definition.isRequired,
      isSearchable: definition.isSearchable,
      options: definition.options?.map((option) => ({ ...option, rowKey: nextOptionKey() })) ?? [],
    })
  }, [definition, open])

  const supportsOptions = values.fieldType === "enum" || values.fieldType === "set"
  const isSubmitting = create.isPending || update.isPending
  const entityItems = useMemo(
    () => entityTypes.map((value) => ({ value, label: entityLabels[value] })),
    [entityLabels],
  )
  const fieldTypeItems = useMemo(
    () => fieldTypes.map((value) => ({ value, label: fieldTypeLabels[value] })),
    [],
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
    const nextErrors = validateForm(values, supportsOptions)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const options = supportsOptions
      ? values.options.map((option) => ({
          label: option.label.trim(),
          value: option.value.trim(),
        }))
      : null

    if (isEditing && definition) {
      const payload: UpdateCustomFieldDefinitionInput = {
        key: values.key.trim(),
        label: values.label.trim(),
        isRequired: values.isRequired,
        isSearchable: values.isSearchable,
        options,
      }
      await update.mutateAsync({ id: definition.id, input: payload })
    } else {
      const payload: CreateCustomFieldDefinitionInput = {
        entityType: values.entityType,
        fieldType: values.fieldType,
        key: values.key.trim(),
        label: values.label.trim(),
        isRequired: values.isRequired,
        isSearchable: values.isSearchable,
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
          <SheetTitle>{isEditing ? "Edit custom field" : "New custom field"}</SheetTitle>
        </SheetHeader>
        <form onSubmit={onSubmit} className="flex flex-1 flex-col overflow-hidden">
          <SheetBody className="grid gap-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Entity</Label>
                {isEditing ? (
                  <ReadOnlyPill>{entityLabels[values.entityType]}</ReadOnlyPill>
                ) : (
                  <Select
                    items={entityItems}
                    value={values.entityType}
                    onValueChange={(value) => setValue("entityType", value as EntityType)}
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
                <Label>Field type</Label>
                {isEditing ? (
                  <ReadOnlyPill>{fieldTypeLabels[values.fieldType]}</ReadOnlyPill>
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
                <Label htmlFor="custom-field-label">Label</Label>
                <Input
                  id="custom-field-label"
                  value={values.label}
                  onChange={(event) => setValue("label", event.target.value)}
                  placeholder="Lead source"
                  autoFocus
                />
                {errors.label ? <p className="text-xs text-destructive">{errors.label}</p> : null}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="custom-field-key">Key</Label>
                <Input
                  id="custom-field-key"
                  value={values.key}
                  onChange={(event) => setValue("key", event.target.value)}
                  placeholder="lead_source"
                  className="font-mono"
                />
                {errors.key ? <p className="text-xs text-destructive">{errors.key}</p> : null}
              </div>
            </div>

            <div className="grid gap-3 rounded-md border p-4">
              <ToggleRow
                label="Required"
                description="Require a value when this field is shown in authoring forms."
                checked={values.isRequired}
                onCheckedChange={(checked) => setValue("isRequired", checked)}
              />
              <ToggleRow
                label="Searchable"
                description="Include this field in custom-field search and filtering workflows."
                checked={values.isSearchable}
                onCheckedChange={(checked) => setValue("isSearchable", checked)}
              />
            </div>

            {supportsOptions ? (
              <div className="grid gap-3">
                <div>
                  <Label>Options</Label>
                  <p className="text-xs text-muted-foreground">
                    Labels are shown to operators; values are stored in custom-field JSON.
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
                        placeholder="Label"
                      />
                      <Input
                        value={option.value}
                        onChange={(event) =>
                          updateOption(option.rowKey, { value: event.target.value })
                        }
                        placeholder="value"
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
                  Add option
                </Button>
              </div>
            ) : null}
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {isEditing ? messages.common.saveChanges : "Create field"}
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
  onCheckedChange,
}: {
  label: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <Label>{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
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

function validateForm(values: FormValues, supportsOptions: boolean): FormErrors {
  const errors: FormErrors = {}
  if (!values.label.trim()) errors.label = "Label is required."
  if (!values.key.trim()) errors.key = "Key is required."

  if (supportsOptions) {
    const validOptions = values.options.filter(
      (option) => option.label.trim() && option.value.trim(),
    )
    if (validOptions.length !== values.options.length || validOptions.length === 0) {
      errors.options = "Add at least one option with both label and value."
    }
  }

  return errors
}
