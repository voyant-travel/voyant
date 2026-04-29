import type { Editor } from "@tiptap/core"
import {
  useLegalContractTemplateAuthoring,
  useLegalContractTemplateVersionMutation,
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
} from "@/components/ui"
import { zodResolver } from "@/lib/zod-resolver"

import { useRegistryLegalMessagesOrDefault } from "./i18n/provider"

type FormValues = {
  body: string
  changelog?: string
  createdBy?: string
}

type TemplateVersionDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  templateId: string
  onSuccess: () => void
}

function createVersionFormSchema(messages: ReturnType<typeof useRegistryLegalMessagesOrDefault>) {
  return z.object({
    body: z.string().min(1, messages.templateVersionDialog.validation.bodyRequired),
    changelog: z.string().optional(),
    createdBy: z.string().optional(),
  })
}

export function TemplateVersionDialog({
  open,
  onOpenChange,
  templateId,
  onSuccess,
}: TemplateVersionDialogProps) {
  const messages = useRegistryLegalMessagesOrDefault()
  const versionFormSchema = createVersionFormSchema(messages)
  const { create } = useLegalContractTemplateVersionMutation()
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
    resolver: zodResolver(versionFormSchema),
    defaultValues: {
      body: "",
      changelog: "",
      createdBy: "",
    },
  })

  useEffect(() => {
    if (open) {
      form.reset()
    }
  }, [open, form])

  const onSubmit = async (values: FormValues) => {
    await create.mutateAsync({
      templateId,
      input: {
        body: values.body,
        changelog: values.changelog || undefined,
        createdBy: values.createdBy || undefined,
      },
    })
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{messages.templateVersionDialog.title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label>{messages.templateVersionDialog.fields.body}</Label>
              <RichTextEditor
                value={form.watch("body")}
                onChange={(value) =>
                  form.setValue("body", value, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  })
                }
                placeholder={messages.templateVersionDialog.placeholders.body}
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

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.templateVersionDialog.fields.changelog}</Label>
                <Input
                  {...form.register("changelog")}
                  placeholder={messages.templateVersionDialog.placeholders.changelog}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.templateVersionDialog.fields.createdBy}</Label>
                <Input
                  {...form.register("createdBy")}
                  placeholder={messages.templateVersionDialog.placeholders.createdBy}
                />
              </div>
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
              {messages.common.createVersion}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
