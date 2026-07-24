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
  Textarea,
} from "@voyant-travel/ui/components"
import { zodResolver } from "@voyant-travel/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import type { ExternalRefsUiMessages } from "../i18n/messages.js"
import { useExternalRefsUiI18nOrDefault } from "../i18n/provider.js"
import {
  type CreateExternalRefInput,
  type ExternalRefRecord,
  type UpdateExternalRefInput,
  useExternalRefMutation,
} from "../index.js"

const REF_STATUSES = ["active", "inactive", "archived"] as const

type RefStatus = (typeof REF_STATUSES)[number]

function createFormSchema(messages: ExternalRefsUiMessages) {
  return z.object({
    sourceSystem: z
      .string()
      .min(1, messages.externalRefDialog.validation.sourceSystemRequired)
      .max(100),
    objectType: z
      .string()
      .min(1, messages.externalRefDialog.validation.objectTypeRequired)
      .max(100),
    namespace: z.string().min(1).max(100),
    externalId: z
      .string()
      .min(1, messages.externalRefDialog.validation.externalIdRequired)
      .max(255),
    externalParentId: z.string().optional().nullable(),
    isPrimary: z.boolean(),
    status: z.enum(REF_STATUSES),
    metadataJson: z
      .string()
      .refine(
        (value) => {
          if (!value || value.trim() === "") return true
          try {
            const parsed = JSON.parse(value)
            return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
          } catch {
            return false
          }
        },
        { message: messages.externalRefDialog.validation.metadataMustBeObject },
      )
      .optional()
      .nullable(),
  })
}

type FormSchema = ReturnType<typeof createFormSchema>
type FormValues = z.input<FormSchema>
type FormOutput = z.output<FormSchema>

export interface ExternalRefDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entityType: string
  entityId: string
  externalRef?: ExternalRefRecord
  onSuccess?: (externalRef: ExternalRefRecord) => void
}

export function ExternalRefDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
  externalRef,
  onSuccess,
}: ExternalRefDialogProps) {
  const isEditing = Boolean(externalRef)
  const { create, update } = useExternalRefMutation()
  const { messages } = useExternalRefsUiI18nOrDefault()
  const m = messages.externalRefDialog
  const formSchema = createFormSchema(messages)

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      sourceSystem: "",
      objectType: "",
      namespace: "default",
      externalId: "",
      externalParentId: "",
      isPrimary: false,
      status: "active",
      metadataJson: "",
    },
  })

  useEffect(() => {
    if (open && externalRef) {
      form.reset({
        sourceSystem: externalRef.sourceSystem,
        objectType: externalRef.objectType,
        namespace: externalRef.namespace,
        externalId: externalRef.externalId,
        externalParentId: externalRef.externalParentId ?? "",
        isPrimary: externalRef.isPrimary,
        status: externalRef.status,
        metadataJson: externalRef.metadata ? JSON.stringify(externalRef.metadata, null, 2) : "",
      })
      return
    }
    if (open) {
      form.reset({
        sourceSystem: "",
        objectType: "",
        namespace: "default",
        externalId: "",
        externalParentId: "",
        isPrimary: false,
        status: "active",
        metadataJson: "",
      })
    }
  }, [externalRef, form, open])

  const onSubmit = async (values: FormOutput) => {
    const metadata =
      values.metadataJson && values.metadataJson.trim() !== ""
        ? (JSON.parse(values.metadataJson) as Record<string, unknown>)
        : null

    const payload: CreateExternalRefInput | UpdateExternalRefInput = {
      entityType,
      entityId,
      sourceSystem: values.sourceSystem,
      objectType: values.objectType,
      namespace: values.namespace,
      externalId: values.externalId,
      externalParentId: values.externalParentId || null,
      isPrimary: values.isPrimary,
      status: values.status,
      metadata,
    }

    const saved = isEditing
      ? await update.mutateAsync({ id: externalRef!.id, input: payload })
      : await create.mutateAsync(payload as CreateExternalRefInput)

    onOpenChange(false)
    onSuccess?.(saved)
  }

  const isSubmitting = form.formState.isSubmitting || create.isPending || update.isPending

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="lg">
        <SheetHeader>
          <SheetTitle>{isEditing ? m.titles.edit : m.titles.add}</SheetTitle>
        </SheetHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <SheetBody className="grid gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{m.labels.sourceSystem}</Label>
                <Input
                  {...form.register("sourceSystem")}
                  placeholder={m.placeholders.sourceSystem}
                />
                {form.formState.errors.sourceSystem ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.sourceSystem.message}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>{m.labels.objectType}</Label>
                <Input {...form.register("objectType")} placeholder={m.placeholders.objectType} />
                {form.formState.errors.objectType ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.objectType.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="flex flex-col gap-2">
                <Label>{m.labels.namespace}</Label>
                <Input {...form.register("namespace")} placeholder={m.placeholders.namespace} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{m.labels.externalId}</Label>
                <Input {...form.register("externalId")} placeholder={m.placeholders.externalId} />
                {form.formState.errors.externalId ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.externalId.message}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>{m.labels.externalParentId}</Label>
                <Input
                  {...form.register("externalParentId")}
                  placeholder={m.placeholders.externalParentId}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{m.labels.status}</Label>
                <Select
                  items={REF_STATUSES.map((status) => ({
                    label: messages.common.refStatusLabels[status],
                    value: status,
                  }))}
                  value={form.watch("status")}
                  onValueChange={(value) => form.setValue("status", value as RefStatus)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REF_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {messages.common.refStatusLabels[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch
                  checked={form.watch("isPrimary")}
                  onCheckedChange={(value) => form.setValue("isPrimary", value)}
                />
                <Label>{m.labels.primary}</Label>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{m.labels.metadataJson}</Label>
              <Textarea
                {...form.register("metadataJson")}
                rows={4}
                className="font-mono text-xs"
                placeholder={m.placeholders.metadataJson}
              />
              {form.formState.errors.metadataJson ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.metadataJson.message}
                </p>
              ) : null}
            </div>
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {m.actions.cancel}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditing ? m.actions.saveChanges : m.actions.addExternalRef}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
