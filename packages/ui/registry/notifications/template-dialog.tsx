"use client"

import type { Editor } from "@tiptap/core"
import {
  type NotificationTemplateRecord,
  useNotificationTemplateAuthoring,
  useNotificationTemplateMutation,
} from "@voyantjs/notifications-react"
import {
  insertPlainText,
  insertVariableToken,
} from "@voyantjs/ui/components/rich-text-variable-extension"
import { Loader2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import {
  Button,
  Checkbox,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  NotificationTemplateAuthoringHelp,
  RichTextEditor,
  Switch,
  Textarea,
} from "@/components/ui"
import { zodResolver } from "@/lib/zod-resolver"
import { useRegistryNotificationsMessagesOrDefault } from "./i18n"

type NotificationTemplateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  template?: NotificationTemplateRecord
  onSuccess: () => void
}

const nativeSelectClassName =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"

const templateAttachmentSchema = z.enum(["contract", "invoice", "brochure"])
type TemplateAttachment = z.infer<typeof templateAttachmentSchema>

function getMetadataRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

function readTemplateAttachments(metadata: unknown): TemplateAttachment[] {
  const record = getMetadataRecord(metadata)
  const value = record?.attachments
  if (!Array.isArray(value)) {
    return []
  }

  return (["contract", "invoice", "brochure"] as const).filter((attachment) =>
    value.includes(attachment),
  )
}

function buildTemplateMetadata(
  metadata: unknown,
  attachments: ReadonlyArray<TemplateAttachment>,
): Record<string, unknown> | null {
  const current = getMetadataRecord(metadata)
  const next = current ? { ...current } : {}

  if (attachments.length > 0) {
    next.attachments = [...attachments]
  } else {
    delete next.attachments
  }

  return Object.keys(next).length > 0 ? next : null
}

export function NotificationTemplateDialog(props: NotificationTemplateDialogProps) {
  if (!props.open) {
    return null
  }

  return <NotificationTemplateDialogInner {...props} />
}

function NotificationTemplateDialogInner({
  open,
  onOpenChange,
  template,
  onSuccess,
}: NotificationTemplateDialogProps) {
  const messages = useRegistryNotificationsMessagesOrDefault()
  const dialogMessages = messages.templateDialog
  const authoringHelpMessages = messages.authoringHelp
  const isEditing = Boolean(template)
  const { create, update } = useNotificationTemplateMutation()
  const CHANNEL_ITEMS = [
    { label: messages.common.channelLabels.email, value: "email" },
    { label: messages.common.channelLabels.sms, value: "sms" },
  ] as const
  const ATTACHMENT_ITEMS = [
    { label: dialogMessages.fields.attachmentContract, value: "contract" },
    { label: dialogMessages.fields.attachmentInvoice, value: "invoice" },
    { label: dialogMessages.fields.attachmentBrochure, value: "brochure" },
  ] as const
  const PROVIDER_ITEMS = [
    { label: messages.common.providerLabels.automatic, value: "automatic" },
    { label: messages.common.providerLabels.resend, value: "resend" },
    { label: messages.common.providerLabels.twilio, value: "twilio" },
  ] as const
  const STATUS_ITEMS = [
    { label: messages.common.templateStatusLabels.draft, value: "draft" },
    { label: messages.common.templateStatusLabels.active, value: "active" },
    { label: messages.common.templateStatusLabels.archived, value: "archived" },
  ] as const
  const templateFormSchema = z.object({
    name: z.string().min(1, dialogMessages.errors.nameRequired),
    slug: z
      .string()
      .min(1, dialogMessages.errors.slugRequired)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, dialogMessages.errors.kebabCase),
    channel: z.enum(["email", "sms"]),
    provider: z.enum(["automatic", "resend", "twilio"]).default("automatic"),
    status: z.enum(["draft", "active", "archived"]).default("draft"),
    subjectTemplate: z.string().optional(),
    htmlTemplate: z.string().optional(),
    textTemplate: z.string().optional(),
    fromAddress: z.string().optional(),
    attachments: z.array(templateAttachmentSchema).default([]),
    active: z.boolean(),
  })
  type FormValues = z.input<typeof templateFormSchema>
  type FormOutput = z.output<typeof templateFormSchema>
  const { variableCatalog, liquidSnippets } = useNotificationTemplateAuthoring()
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null)
  const variableGroups = useMemo(
    () =>
      variableCatalog.map((group) => ({
        ...group,
        variables: group.variables.map((variable) => ({
          ...variable,
          example: String(variable.example),
        })),
      })),
    [variableCatalog],
  )

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: "",
      slug: "",
      channel: "email",
      provider: "automatic",
      status: "draft",
      subjectTemplate: "",
      htmlTemplate: "",
      textTemplate: "",
      fromAddress: "",
      attachments: [],
      active: true,
    },
  })

  const channel = form.watch("channel")
  const attachments = form.watch("attachments") ?? []

  useEffect(() => {
    if (open && template) {
      form.reset({
        name: template.name,
        slug: template.slug,
        channel: template.channel,
        provider:
          template.provider === "resend" || template.provider === "twilio"
            ? template.provider
            : "automatic",
        status: template.status,
        subjectTemplate: template.subjectTemplate ?? "",
        htmlTemplate: template.htmlTemplate ?? "",
        textTemplate: template.textTemplate ?? "",
        fromAddress: template.fromAddress ?? "",
        attachments: template.channel === "email" ? readTemplateAttachments(template.metadata) : [],
        active: template.status === "active",
      })
      return
    }

    if (open) {
      form.reset()
    }
  }, [open, template, form])

  useEffect(() => {
    if (!open || channel === "email" || (form.getValues("attachments") ?? []).length === 0) return
    form.setValue("attachments", [], {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    })
  }, [channel, form, open])

  const onSubmit = async (values: FormOutput) => {
    const payload = {
      name: values.name,
      slug: values.slug,
      channel: values.channel,
      provider: values.provider === "automatic" ? null : values.provider,
      status: values.active ? (values.status === "archived" ? "active" : values.status) : "draft",
      subjectTemplate: values.channel === "email" ? values.subjectTemplate || null : null,
      htmlTemplate: values.channel === "email" ? values.htmlTemplate || null : null,
      textTemplate: values.channel === "sms" ? values.textTemplate || null : null,
      fromAddress: values.channel === "email" ? values.fromAddress || null : null,
      isSystem: template?.isSystem ?? false,
      metadata:
        values.channel === "email"
          ? buildTemplateMetadata(template?.metadata, values.attachments)
          : buildTemplateMetadata(template?.metadata, []),
    }

    if (isEditing && template) {
      await update.mutateAsync({ id: template.id, input: payload })
    } else {
      await create.mutateAsync(payload)
    }

    onSuccess()
  }

  const isPending = create.isPending || update.isPending

  const setAttachmentSelected = (attachment: TemplateAttachment, checked: boolean) => {
    const current = form.getValues("attachments") ?? []
    const next = checked
      ? [...current, attachment].filter((value, index, values) => values.indexOf(value) === index)
      : current.filter((value) => value !== attachment)

    form.setValue("attachments", next, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? dialogMessages.titleEdit : dialogMessages.titleNew}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.name}</Label>
                <Input {...form.register("name")} placeholder={dialogMessages.placeholders.name} />
                {form.formState.errors.name ? (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.slug}</Label>
                <Input {...form.register("slug")} placeholder={dialogMessages.placeholders.slug} />
                {form.formState.errors.slug ? (
                  <p className="text-xs text-destructive">{form.formState.errors.slug.message}</p>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.channel}</Label>
                <select
                  className={nativeSelectClassName}
                  value={form.watch("channel")}
                  onChange={(event) => {
                    const nextChannel = event.target.value as FormValues["channel"]
                    if (form.getValues("channel") === nextChannel) return
                    form.setValue("channel", nextChannel, {
                      shouldDirty: true,
                      shouldTouch: true,
                      shouldValidate: true,
                    })
                  }}
                >
                  {CHANNEL_ITEMS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.provider}</Label>
                <select
                  className={nativeSelectClassName}
                  value={form.watch("provider")}
                  onChange={(event) => {
                    const nextProvider = event.target.value as FormValues["provider"]
                    if (form.getValues("provider") === nextProvider) return
                    form.setValue("provider", nextProvider, {
                      shouldDirty: true,
                      shouldTouch: true,
                      shouldValidate: true,
                    })
                  }}
                >
                  {PROVIDER_ITEMS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.status}</Label>
                <select
                  className={nativeSelectClassName}
                  value={form.watch("status")}
                  onChange={(event) => {
                    const nextStatus = event.target.value as FormValues["status"]
                    if (form.getValues("status") === nextStatus) return
                    form.setValue("status", nextStatus, {
                      shouldDirty: true,
                      shouldTouch: true,
                      shouldValidate: true,
                    })
                  }}
                >
                  {STATUS_ITEMS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {channel === "email" ? (
              <>
                <div className="flex flex-col gap-2">
                  <Label>{dialogMessages.fields.attachments}</Label>
                  <div className="flex flex-wrap gap-3">
                    {ATTACHMENT_ITEMS.map((item) => (
                      <div
                        key={item.value}
                        className="flex h-9 items-center gap-2 rounded-md border px-3 text-sm"
                      >
                        <Checkbox
                          id={`notification-template-attachment-${item.value}`}
                          checked={attachments.includes(item.value)}
                          onCheckedChange={(checked) =>
                            setAttachmentSelected(item.value, checked === true)
                          }
                        />
                        <Label
                          htmlFor={`notification-template-attachment-${item.value}`}
                          className="cursor-pointer text-sm font-normal"
                        >
                          {item.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <Label>{dialogMessages.fields.fromAddress}</Label>
                    <Input
                      {...form.register("fromAddress")}
                      placeholder={dialogMessages.placeholders.fromAddress}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>{dialogMessages.fields.subject}</Label>
                    <Input
                      {...form.register("subjectTemplate")}
                      placeholder={dialogMessages.placeholders.subject}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Label>{dialogMessages.fields.htmlBody}</Label>
                  <RichTextEditor
                    value={form.watch("htmlTemplate") ?? ""}
                    onChange={(value) =>
                      form.setValue("htmlTemplate", value, {
                        shouldDirty: true,
                        shouldTouch: true,
                        shouldValidate: true,
                      })
                    }
                    placeholder={dialogMessages.placeholders.htmlBody}
                    enableVariables
                    onEditorReady={setEditorInstance}
                  />
                </div>
              </>
            ) : null}

            {channel === "sms" ? (
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.textBodySms}</Label>
                <Textarea
                  {...form.register("textTemplate")}
                  placeholder={dialogMessages.placeholders.textBodySms}
                  rows={6}
                />
              </div>
            ) : null}

            <NotificationTemplateAuthoringHelp
              variableGroups={variableGroups}
              snippets={liquidSnippets}
              onInsertVariable={(variable) => {
                if (!editorInstance || channel !== "email") return
                insertVariableToken(editorInstance, variable.key)
              }}
              onInsertSnippet={(snippet) => {
                if (channel === "email") {
                  if (!editorInstance) return
                  insertPlainText(editorInstance, snippet.code)
                  return
                }
                if (channel !== "sms") return
                const current = form.getValues("textTemplate") ?? ""
                form.setValue(
                  "textTemplate",
                  current ? `${current}\n${snippet.code}` : snippet.code,
                  {
                    shouldDirty: true,
                    shouldTouch: true,
                  },
                )
              }}
              messages={authoringHelpMessages}
            />

            <div className="flex items-center gap-3">
              <Switch
                checked={form.watch("active")}
                onCheckedChange={(checked) => form.setValue("active", checked)}
              />
              <Label className="cursor-pointer">{dialogMessages.fields.activateAfterSaving}</Label>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditing ? messages.common.saveChanges : dialogMessages.actions.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
