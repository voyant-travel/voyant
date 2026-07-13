import { useOperatorAdminMessages } from "@voyant-travel/admin"
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
} from "@voyant-travel/ui/components"
import { RichTextEditor } from "@voyant-travel/ui/components/rich-text-editor"
import { zodResolver } from "@voyant-travel/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import {
  useLegalContractTemplateAuthoring,
  useLegalContractTemplateVersionMutation,
} from "../index.js"

const versionFormSchema = z.object({
  body: z.string().min(1, "bodyRequired"),
  changelog: z.string().optional(),
  createdBy: z.string().optional(),
})

type FormValues = z.input<typeof versionFormSchema>
type FormOutput = z.output<typeof versionFormSchema>

type TemplateVersionDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  templateId: string
  onSuccess: () => void
}

export function TemplateVersionDialog({
  open,
  onOpenChange,
  templateId,
  onSuccess,
}: TemplateVersionDialogProps) {
  const t = useOperatorAdminMessages().legal.templateVersionDialog
  const { create } = useLegalContractTemplateVersionMutation()
  const { variableCatalog, liquidSnippets } = useLegalContractTemplateAuthoring()

  const resolveValidation = (code: string | undefined) =>
    code === "bodyRequired" ? t.validation.bodyRequired : code || ""
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

  const onSubmit = async (values: FormOutput) => {
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
          <DialogTitle>{t.titleNew}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <DialogBody className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label>{t.bodyLabel}</Label>
              <RichTextEditor
                value={form.watch("body")}
                onChange={(value) =>
                  form.setValue("body", value, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  })
                }
                placeholder={t.bodyPlaceholder}
                enableVariables
              />
              {form.formState.errors.body ? (
                <p className="text-xs text-destructive">
                  {resolveValidation(form.formState.errors.body.message)}
                </p>
              ) : null}
            </div>

            <ContractTemplateAuthoringHelp
              variableGroups={variableGroups}
              snippets={liquidSnippets}
            />

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{t.changelogLabel}</Label>
                <Input {...form.register("changelog")} placeholder={t.changelogPlaceholder} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{t.createdByLabel}</Label>
                <Input {...form.register("createdBy")} placeholder={t.createdByPlaceholder} />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t.cancel}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t.createAction}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
