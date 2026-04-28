import { useLegalContractSignatureMutation } from "@voyantjs/legal-react"
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
} from "@voyantjs/voyant-ui/components"
import { zodResolver } from "@voyantjs/voyant-ui/lib/zod-resolver"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"

const signatureFormSchema = z.object({
  signerName: z.string().min(1, "Signer name is required"),
  signerEmail: z.string().email().optional().or(z.literal("")),
  signerRole: z.string().optional(),
  method: z.enum(["manual", "electronic", "docusign", "other"]),
  provider: z.string().optional(),
  externalReference: z.string().optional(),
})

type FormValues = z.input<typeof signatureFormSchema>
type FormOutput = z.output<typeof signatureFormSchema>

type SignatureDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  contractId: string
  onSuccess: () => void
}

const METHODS = [
  { value: "manual", label: "Manual" },
  { value: "electronic", label: "Electronic" },
  { value: "docusign", label: "DocuSign" },
  { value: "other", label: "Other" },
] as const

export function SignatureDialog({
  open,
  onOpenChange,
  contractId,
  onSuccess,
}: SignatureDialogProps) {
  const { create } = useLegalContractSignatureMutation()
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
          <DialogTitle>Record Signature</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="flex flex-col gap-2">
              <Label>Signer Name</Label>
              <Input {...form.register("signerName")} placeholder="Full name" />
              {form.formState.errors.signerName && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.signerName.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Signer Email</Label>
                <Input
                  {...form.register("signerEmail")}
                  type="email"
                  placeholder="email@example.com"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Signer Role</Label>
                <Input {...form.register("signerRole")} placeholder="e.g. CEO, Legal Rep" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Method</Label>
              <Select
                items={METHODS}
                value={form.watch("method")}
                onValueChange={(v) => form.setValue("method", v as FormValues["method"])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Provider</Label>
                <Input {...form.register("provider")} placeholder="Optional" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>External Reference</Label>
                <Input {...form.register("externalReference")} placeholder="Optional" />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Record Signature
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
