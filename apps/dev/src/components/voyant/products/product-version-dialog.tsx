import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Textarea,
} from "@voyantjs/ui/components"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { api } from "@/lib/api-client"
import { zodResolver } from "@/lib/zod-resolver"

const versionFormSchema = z.object({
  notes: z.string().max(10000).optional().nullable(),
})

type VersionFormValues = z.input<typeof versionFormSchema>
type VersionFormOutput = z.output<typeof versionFormSchema>

type VersionDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId: string
  onSuccess: () => void
}

export function VersionDialog({ open, onOpenChange, productId, onSuccess }: VersionDialogProps) {
  const form = useForm<VersionFormValues, unknown, VersionFormOutput>({
    resolver: zodResolver(versionFormSchema),
    defaultValues: {
      notes: "",
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({ notes: "" })
    }
  }, [open, form])

  const onSubmit = async (values: VersionFormOutput) => {
    await api.post(`/v1/products/${productId}/versions`, {
      notes: values.notes || null,
    })
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Version Snapshot</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              This will save a snapshot of the current product with all its days and services.
            </p>
            <div className="flex flex-col gap-2">
              <Label>Notes (optional)</Label>
              <Textarea {...form.register("notes")} placeholder="What changed in this version..." />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Version
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
