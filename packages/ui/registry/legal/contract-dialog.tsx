import { type LegalContractRecord, useLegalContractMutation } from "@voyantjs/legal-react"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"

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
  Textarea,
} from "@/components/ui"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { zodResolver } from "@/lib/zod-resolver"

import { useRegistryLegalMessagesOrDefault } from "./i18n/provider"

type FormValues = {
  scope: "customer" | "supplier" | "partner" | "channel" | "other"
  title: string
  language?: string
  templateVersionId?: string
  seriesId?: string
  personId?: string
  organizationId?: string
  supplierId?: string
  channelId?: string
  expiresAt?: string
  variables?: string
  metadata?: string
}

type ContractDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  contract?: LegalContractRecord
  onSuccess: () => void
}

function createContractFormSchema(messages: ReturnType<typeof useRegistryLegalMessagesOrDefault>) {
  return z.object({
    scope: z.enum(["customer", "supplier", "partner", "channel", "other"]),
    title: z.string().min(1, messages.contractDialog.validation.titleRequired),
    language: z.string().min(2).max(10).optional(),
    templateVersionId: z.string().optional(),
    seriesId: z.string().optional(),
    personId: z.string().optional(),
    organizationId: z.string().optional(),
    supplierId: z.string().optional(),
    channelId: z.string().optional(),
    expiresAt: z.string().optional(),
    variables: z.string().optional(),
    metadata: z.string().optional(),
  })
}

const SCOPES = ["customer", "supplier", "partner", "channel", "other"] as const

export function ContractDialog({ open, onOpenChange, contract, onSuccess }: ContractDialogProps) {
  const messages = useRegistryLegalMessagesOrDefault()
  const contractFormSchema = createContractFormSchema(messages)
  const isEditing = !!contract
  const { create, update } = useLegalContractMutation()

  const form = useForm<FormValues>({
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
      variables: "",
      metadata: "",
    },
  })

  useEffect(() => {
    if (open && contract) {
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
        variables: contract.variables ? JSON.stringify(contract.variables, null, 2) : "",
        metadata: contract.metadata ? JSON.stringify(contract.metadata, null, 2) : "",
      })
    } else if (open) {
      form.reset()
    }
  }, [open, contract, form])

  const onSubmit = async (values: FormValues) => {
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
      variables: values.variables ? JSON.parse(values.variables) : undefined,
      metadata: values.metadata ? JSON.parse(values.metadata) : undefined,
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
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? messages.contractDialog.titles.edit
              : messages.contractDialog.titles.create}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.contractDialog.fields.scope}</Label>
                <Select
                  items={SCOPES.map((scope) => ({
                    label: messages.common.contractScopeLabels[scope],
                    value: scope,
                  }))}
                  value={form.watch("scope")}
                  onValueChange={(v) => form.setValue("scope", v as FormValues["scope"])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCOPES.map((scope) => (
                      <SelectItem key={scope} value={scope}>
                        {messages.common.contractScopeLabels[scope]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.contractDialog.fields.language}</Label>
                <Input
                  {...form.register("language")}
                  placeholder={messages.contractDialog.placeholders.language}
                  maxLength={10}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.contractDialog.fields.title}</Label>
              <Input
                {...form.register("title")}
                placeholder={messages.contractDialog.placeholders.title}
              />
              {form.formState.errors.title ? (
                <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.contractDialog.fields.templateVersionId}</Label>
                <Input
                  {...form.register("templateVersionId")}
                  placeholder={messages.contractDialog.placeholders.optional}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.contractDialog.fields.seriesId}</Label>
                <Input
                  {...form.register("seriesId")}
                  placeholder={messages.contractDialog.placeholders.optional}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.contractDialog.fields.personId}</Label>
                <Input
                  {...form.register("personId")}
                  placeholder={messages.contractDialog.placeholders.optional}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.contractDialog.fields.organizationId}</Label>
                <Input
                  {...form.register("organizationId")}
                  placeholder={messages.contractDialog.placeholders.optional}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.contractDialog.fields.supplierId}</Label>
                <Input
                  {...form.register("supplierId")}
                  placeholder={messages.contractDialog.placeholders.optional}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.contractDialog.fields.channelId}</Label>
                <Input
                  {...form.register("channelId")}
                  placeholder={messages.contractDialog.placeholders.optional}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.contractDialog.fields.expiresAt}</Label>
              <DateTimePicker
                value={form.watch("expiresAt") || null}
                onChange={(next) =>
                  form.setValue("expiresAt", next ?? "", {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                placeholder={messages.contractDialog.placeholders.expiresAt}
                className="w-full"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.contractDialog.fields.variables}</Label>
              <Textarea
                {...form.register("variables")}
                placeholder={messages.contractDialog.placeholders.variables}
                rows={3}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.contractDialog.fields.metadata}</Label>
              <Textarea
                {...form.register("metadata")}
                placeholder={messages.contractDialog.placeholders.metadata}
                rows={3}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {isEditing ? messages.common.saveChanges : messages.contractDialog.actions.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
