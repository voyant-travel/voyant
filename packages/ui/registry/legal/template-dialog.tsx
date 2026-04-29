import type { Editor } from "@tiptap/core"
import {
  type LegalContractTemplateRecord,
  useLegalContractTemplateAuthoring,
  useLegalContractTemplateMutation,
} from "@voyantjs/legal-react"
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
  ContractTemplateAuthoringHelp,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  RichTextEditor,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/components/ui"
import { Switch } from "@/components/ui/switch"
import { zodResolver } from "@/lib/zod-resolver"

import { useRegistryLegalMessagesOrDefault } from "./i18n/provider"

type FormValues = {
  name: string
  slug: string
  scope: "customer" | "supplier" | "partner" | "channel" | "other"
  language?: string
  description?: string
  body: string
  active: boolean
}

type TemplateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  template?: LegalContractTemplateRecord
  onSuccess: () => void
}

function createTemplateFormSchema(messages: ReturnType<typeof useRegistryLegalMessagesOrDefault>) {
  return z.object({
    name: z.string().min(1, messages.templateDialog.validation.nameRequired),
    slug: z
      .string()
      .min(1, messages.templateDialog.validation.slugRequired)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, messages.templateDialog.validation.slugKebabCase),
    scope: z.enum(["customer", "supplier", "partner", "channel", "other"]),
    language: z.string().min(2).max(10).optional(),
    description: z.string().optional(),
    body: z.string().min(1, messages.templateDialog.validation.bodyRequired),
    active: z.boolean(),
  })
}

const SCOPES = ["customer", "supplier", "partner", "channel", "other"] as const

export function TemplateDialog({ open, onOpenChange, template, onSuccess }: TemplateDialogProps) {
  const messages = useRegistryLegalMessagesOrDefault()
  const templateFormSchema = createTemplateFormSchema(messages)
  const isEditing = !!template
  const { create, update } = useLegalContractTemplateMutation()
  const { variableCatalog, liquidSnippets } = useLegalContractTemplateAuthoring()
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

  const form = useForm<FormValues>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: "",
      slug: "",
      scope: "customer",
      language: "en",
      description: "",
      body: "",
      active: true,
    },
  })

  useEffect(() => {
    if (open && template) {
      form.reset({
        name: template.name,
        slug: template.slug,
        scope: template.scope as FormValues["scope"],
        language: template.language,
        description: template.description ?? "",
        body: template.body,
        active: template.active,
      })
    } else if (open) {
      form.reset()
    }
  }, [open, template, form])

  const onSubmit = async (values: FormValues) => {
    const payload = {
      name: values.name,
      slug: values.slug,
      scope: values.scope,
      language: values.language || "en",
      description: values.description || undefined,
      body: values.body,
      active: values.active,
    }

    if (isEditing && template) {
      await update.mutateAsync({ id: template.id, input: payload })
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
              ? messages.templateDialog.titles.edit
              : messages.templateDialog.titles.create}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.templateDialog.fields.name}</Label>
                <Input
                  {...form.register("name")}
                  placeholder={messages.templateDialog.placeholders.name}
                />
                {form.formState.errors.name ? (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.templateDialog.fields.slug}</Label>
                <Input
                  {...form.register("slug")}
                  placeholder={messages.templateDialog.placeholders.slug}
                />
                {form.formState.errors.slug ? (
                  <p className="text-xs text-destructive">{form.formState.errors.slug.message}</p>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.templateDialog.fields.scope}</Label>
                <Select
                  items={SCOPES.map((scope) => ({
                    label: messages.common.contractScopeLabels[scope],
                    value: scope,
                  }))}
                  value={form.watch("scope")}
                  onValueChange={(value) => form.setValue("scope", value as FormValues["scope"])}
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
                <Label>{messages.templateDialog.fields.language}</Label>
                <Input
                  {...form.register("language")}
                  placeholder={messages.templateDialog.placeholders.language}
                  maxLength={10}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.templateDialog.fields.description}</Label>
              <Textarea
                {...form.register("description")}
                placeholder={messages.templateDialog.placeholders.description}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.templateDialog.fields.body}</Label>
              <RichTextEditor
                value={form.watch("body")}
                onChange={(value) =>
                  form.setValue("body", value, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  })
                }
                placeholder={messages.templateDialog.placeholders.body}
                enableVariables
                onEditorReady={setEditorInstance}
              />
              {form.formState.errors.body ? (
                <p className="text-xs text-destructive">{form.formState.errors.body.message}</p>
              ) : null}
            </div>

            <ContractTemplateAuthoringHelp
              title={messages.authoringHelp.title}
              description={messages.authoringHelp.description}
              messages={messages.authoringHelp}
              variableGroups={variableGroups}
              snippets={liquidSnippets}
              onInsertVariable={(variable) => {
                if (!editorInstance) return
                insertVariableToken(editorInstance, variable.key)
              }}
              onInsertSnippet={(snippet) => {
                if (!editorInstance) return
                insertPlainText(editorInstance, snippet.code)
              }}
            />

            <div className="flex items-center gap-2">
              <Switch
                checked={form.watch("active")}
                onCheckedChange={(checked) => form.setValue("active", checked)}
              />
              <Label>{messages.templateDialog.fields.active}</Label>
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
              {isEditing ? messages.common.saveChanges : messages.templateDialog.actions.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
