"use client"

import {
  type CreateExternalRefInput,
  type ExternalRefRecord,
  type UpdateExternalRefInput,
  useExternalRefMutation,
} from "@voyantjs/external-refs-react"
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
  Textarea,
} from "@voyantjs/ui/components"
import { zodResolver } from "@voyantjs/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"

const REF_STATUSES = ["active", "inactive", "archived"] as const

type RefStatus = (typeof REF_STATUSES)[number]

const formSchema = z.object({
  sourceSystem: z.string().min(1, "Source system is required").max(100),
  objectType: z.string().min(1, "Object type is required").max(100),
  namespace: z.string().min(1).max(100),
  externalId: z.string().min(1, "External ID is required").max(255),
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
      { message: "Must be a JSON object" },
    )
    .optional()
    .nullable(),
})

type FormValues = z.input<typeof formSchema>
type FormOutput = z.output<typeof formSchema>

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit External Ref" : "Add External Ref"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Source system</Label>
                <Input
                  {...form.register("sourceSystem")}
                  placeholder="bokun, pipedrive, stripe..."
                />
                {form.formState.errors.sourceSystem ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.sourceSystem.message}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>Object type</Label>
                <Input {...form.register("objectType")} placeholder="booking, person, product..." />
                {form.formState.errors.objectType ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.objectType.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-2">
                <Label>Namespace</Label>
                <Input {...form.register("namespace")} placeholder="default" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>External ID</Label>
                <Input {...form.register("externalId")} placeholder="abc-123" />
                {form.formState.errors.externalId ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.externalId.message}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>External parent ID</Label>
                <Input {...form.register("externalParentId")} placeholder="parent-id..." />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Status</Label>
                <Select
                  items={REF_STATUSES.map((x) => ({ label: x.replace(/_/g, " "), value: x }))}
                  value={form.watch("status")}
                  onValueChange={(value) => form.setValue("status", value as RefStatus)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REF_STATUSES.map((status) => (
                      <SelectItem key={status} value={status} className="capitalize">
                        {status}
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
                <Label>Primary</Label>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Metadata (JSON)</Label>
              <Textarea
                {...form.register("metadataJson")}
                rows={4}
                className="font-mono text-xs"
                placeholder='{ "key": "value" }'
              />
              {form.formState.errors.metadataJson ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.metadataJson.message}
                </p>
              ) : null}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditing ? "Save Changes" : "Add External Ref"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
