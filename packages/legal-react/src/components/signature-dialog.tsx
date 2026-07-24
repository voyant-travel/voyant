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
} from "@voyant-travel/ui/components"
import { zodResolver } from "@voyant-travel/ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { useLegalUiMessagesOrDefault } from "../i18n/index.js"
import { type LegalSignatureMethod, legalSignatureMethods } from "../i18n/messages.js"
import { useLegalContractSignatureMutation } from "../index.js"

function createSignatureFormSchema(messages: ReturnType<typeof useLegalUiMessagesOrDefault>) {
  return z.object({
    signerName: z.string().min(1, messages.signatureDialog.validation.signerNameRequired),
    signerEmail: z
      .string()
      .email(messages.signatureDialog.validation.signerEmailInvalid)
      .optional()
      .or(z.literal("")),
    signerRole: z.string().optional(),
    method: z.enum(legalSignatureMethods),
    provider: z.string().optional(),
    externalReference: z.string().optional(),
  })
}

type SignatureFormSchema = ReturnType<typeof createSignatureFormSchema>
type FormValues = z.input<SignatureFormSchema>
type FormOutput = z.output<SignatureFormSchema>

type SignatureDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  contractId: string
  onSuccess: () => void
}

export function SignatureDialog({
  open,
  onOpenChange,
  contractId,
  onSuccess,
}: SignatureDialogProps) {
  const { create } = useLegalContractSignatureMutation()
  const messages = useLegalUiMessagesOrDefault()
  const signatureFormSchema = createSignatureFormSchema(messages)
  const methodItems = legalSignatureMethods.map((value) => ({
    value,
    label: messages.signatureDialog.methodLabels[value],
  }))
  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(signatureFormSchema),
    defaultValues: {
      signerName: "",
      signerEmail: "",
      signerRole: "",
      method: "manual",
      provider: "",
      externalReference: "",
    },
  })

  useEffect(() => {
    if (open) {
      form.reset()
    }
  }, [open, form])

  const onSubmit = async (values: FormOutput) => {
    await create.mutateAsync({
      contractId,
      input: {
        signerName: values.signerName,
        signerEmail: values.signerEmail || undefined,
        signerRole: values.signerRole || undefined,
        method: values.method,
        provider: values.provider || undefined,
        externalReference: values.externalReference || undefined,
      },
    })
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{messages.signatureDialog.title}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <DialogBody className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label>{messages.signatureDialog.fields.signerName}</Label>
              <Input
                {...form.register("signerName")}
                placeholder={messages.signatureDialog.placeholders.signerName}
              />
              {form.formState.errors.signerName && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.signerName.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.signatureDialog.fields.signerEmail}</Label>
                <Input
                  {...form.register("signerEmail")}
                  type="email"
                  placeholder={messages.signatureDialog.placeholders.signerEmail}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.signatureDialog.fields.signerRole}</Label>
                <Input
                  {...form.register("signerRole")}
                  placeholder={messages.signatureDialog.placeholders.signerRole}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.signatureDialog.fields.method}</Label>
              <Select
                items={methodItems}
                value={form.watch("method")}
                onValueChange={(v) =>
                  form.setValue("method", v as LegalSignatureMethod, { shouldValidate: true })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {methodItems.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.signatureDialog.fields.provider}</Label>
                <Input
                  {...form.register("provider")}
                  placeholder={messages.signatureDialog.placeholders.provider}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.signatureDialog.fields.externalReference}</Label>
                <Input
                  {...form.register("externalReference")}
                  placeholder={messages.signatureDialog.placeholders.externalReference}
                />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {messages.signatureDialog.actions.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
