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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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

export function NotificationTemplateDialog({
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
      active: true,
    },
  })

  const channel = form.watch("channel")

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
        active: template.status === "active",
      })
      return
    }

    if (open) {
      form.reset()
    }
  }, [open, template, form])

  const onSubmit = async (values: FormOutput) => {
    const payload = {
      name: values.name,
      slug: values.slug,
      channel: values.channel,
      provider: values.provider === "automatic" ? null : values.provider,
      status: values.active ? (values.status === "archived" ? "active" : values.status) : "draft",
      subjectTemplate: values.channel === "email" ? values.subjectTemplate || null : null,
      htmlTemplate: values.channel === "email" ? values.htmlTemplate || null : null,
      textTemplate: values.textTemplate || null,
      fromAddress: values.channel === "email" ? values.fromAddress || null : null,
      isSystem: template?.isSystem ?? false,
      metadata: template?.metadata ?? null,
    }

    if (isEditing && template) {
      await update.mutateAsync({ id: template.id, input: payload })
    } else {
      await create.mutateAsync(payload)
    }

    onSuccess()
  }

  const isPending = create.isPending || update.isPending

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
                <Select
                  items={CHANNEL_ITEMS}
                  value={form.watch("channel")}
                  onValueChange={(value) =>
                    form.setValue("channel", value as FormValues["channel"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNEL_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.provider}</Label>
                <Select
                  items={PROVIDER_ITEMS}
                  value={form.watch("provider")}
                  onValueChange={(value) =>
                    form.setValue("provider", value as FormValues["provider"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDER_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.status}</Label>
                <Select
                  items={STATUS_ITEMS}
                  value={form.watch("status")}
                  onValueChange={(value) => form.setValue("status", value as FormValues["status"])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {channel === "email" ? (
              <>
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

            <div className="flex flex-col gap-2">
              <Label>
                {channel === "sms"
                  ? dialogMessages.fields.textBodySms
                  : dialogMessages.fields.textFallback}
              </Label>
              <Textarea
                {...form.register("textTemplate")}
                placeholder={
                  channel === "sms"
                    ? dialogMessages.placeholders.textBodySms
                    : dialogMessages.placeholders.textFallback
                }
                rows={6}
              />
            </div>

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
