import {
  type LegalContractNumberSeriesRecord,
  useLegalContractNumberSeriesMutation,
} from "@voyantjs/legal-react"
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
} from "@voyantjs/ui/components"
import { Switch } from "@voyantjs/ui/components/switch"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { zodResolver } from "@/lib/zod-resolver"

const seriesFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  prefix: z.string().min(1, "Prefix is required").max(20),
  separator: z.string().max(5).optional(),
  padLength: z.coerce.number().int().min(0).max(12).optional(),
  resetStrategy: z.enum(["never", "annual", "monthly"]),
  scope: z.enum(["customer", "supplier", "partner", "channel", "other"]),
  active: z.boolean(),
})

type FormValues = z.input<typeof seriesFormSchema>
type FormOutput = z.output<typeof seriesFormSchema>

export type NumberSeriesData = LegalContractNumberSeriesRecord

type NumberSeriesDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  series?: NumberSeriesData
  onSuccess: () => void
}

const RESET_STRATEGIES = [
  { value: "never", label: "Never" },
  { value: "annual", label: "Annual" },
  { value: "monthly", label: "Monthly" },
] as const

const SCOPES = [
  { value: "customer", label: "Customer" },
  { value: "supplier", label: "Supplier" },
  { value: "partner", label: "Partner" },
  { value: "channel", label: "Channel" },
  { value: "other", label: "Other" },
] as const

export function NumberSeriesDialog({
  open,
  onOpenChange,
  series,
  onSuccess,
}: NumberSeriesDialogProps) {
  const isEditing = !!series
  const { create, update } = useLegalContractNumberSeriesMutation()

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(seriesFormSchema),
    defaultValues: {
      name: "",
      prefix: "CTR",
      separator: "",
      padLength: 4,
      resetStrategy: "never",
      scope: "customer",
      active: true,
    },
  })

  useEffect(() => {
    if (open && series) {
      form.reset({
        name: series.name,
        prefix: series.prefix,
        separator: series.separator,
        padLength: series.padLength,
        resetStrategy: series.resetStrategy as FormValues["resetStrategy"],
        scope: series.scope as FormValues["scope"],
        active: series.active,
      })
    } else if (open) {
      form.reset()
    }
  }, [open, series, form])

  const onSubmit = async (values: FormOutput) => {
    const payload = {
      name: values.name,
      prefix: values.prefix,
      separator: values.separator || "",
      padLength: values.padLength ?? 4,
      resetStrategy: values.resetStrategy,
      scope: values.scope,
      active: values.active,
    }

    if (isEditing && series) {
      await update.mutateAsync({ id: series.id, input: payload })
    } else {
      await create.mutateAsync(payload)
    }
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Number Series" : "New Number Series"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Name</Label>
                <Input {...form.register("name")} placeholder="Invoice Series" />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Prefix</Label>
                <Input {...form.register("prefix")} placeholder="CTR" maxLength={20} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Separator</Label>
                <Input {...form.register("separator")} placeholder="-" maxLength={5} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Pad Length</Label>
                <Input {...form.register("padLength")} type="number" min={0} max={12} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Reset Strategy</Label>
                <Select
                  items={RESET_STRATEGIES}
                  value={form.watch("resetStrategy")}
                  onValueChange={(v) =>
                    form.setValue("resetStrategy", v as FormValues["resetStrategy"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RESET_STRATEGIES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Scope</Label>
                <Select
                  items={SCOPES}
                  value={form.watch("scope")}
                  onValueChange={(v) => form.setValue("scope", v as FormValues["scope"])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCOPES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.watch("active")}
                onCheckedChange={(checked) => form.setValue("active", checked)}
              />
              <Label>Active</Label>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Create Series"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
