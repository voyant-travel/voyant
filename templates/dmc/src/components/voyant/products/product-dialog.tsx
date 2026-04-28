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
} from "@voyantjs/ui/components"
import { DateRangePicker } from "@voyantjs/ui/components/date-picker"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { useAdminMessages } from "@/lib/admin-i18n"
import { api } from "@/lib/api-client"
import { zodResolver } from "@/lib/zod-resolver"

const productFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  status: z.enum(["draft", "active", "archived"]),
  description: z.string().optional().nullable(),
  sellCurrency: z.string().min(3).max(3, "Use 3-letter ISO code"),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  pax: z.coerce.number().int().positive().optional().or(z.literal("")).nullable(),
})

type ProductFormValues = z.input<typeof productFormSchema>
type ProductFormOutput = z.output<typeof productFormSchema>

type ProductData = {
  id: string
  name: string
  status: "draft" | "active" | "archived"
  description: string | null
  sellCurrency: string
  startDate: string | null
  endDate: string | null
  pax: number | null
}

type ProductDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  product?: ProductData
  onSuccess: () => void
}

const PRODUCT_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
] as const

export function ProductDialog({ open, onOpenChange, product, onSuccess }: ProductDialogProps) {
  const isEditing = !!product
  const messages = useAdminMessages().products

  const form = useForm<ProductFormValues, unknown, ProductFormOutput>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      status: "draft",
      description: "",
      sellCurrency: "EUR",
      startDate: "",
      endDate: "",
      pax: "",
    },
  })

  useEffect(() => {
    if (open && product) {
      form.reset({
        name: product.name,
        status: product.status,
        description: product.description ?? "",
        sellCurrency: product.sellCurrency,
        startDate: product.startDate ?? "",
        endDate: product.endDate ?? "",
        pax: product.pax ?? "",
      })
    } else if (open) {
      form.reset()
    }
  }, [open, product, form])

  const onSubmit = async (values: ProductFormOutput) => {
    const payload = {
      name: values.name,
      status: values.status,
      description: values.description || null,
      sellCurrency: values.sellCurrency,
      startDate: values.startDate || null,
      endDate: values.endDate || null,
      pax: values.pax && typeof values.pax === "number" ? values.pax : null,
    }

    if (isEditing) {
      await api.patch(`/v1/products/${product.id}`, payload)
    } else {
      await api.post("/v1/products", payload)
    }
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? messages.dialogEditTitle : messages.dialogNewTitle}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.nameLabel}</Label>
                <Input {...form.register("name")} placeholder={messages.namePlaceholder} />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">{messages.validationNameRequired}</p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label>{messages.statusLabel}</Label>
                <Select
                  items={PRODUCT_STATUSES}
                  value={form.watch("status")}
                  onValueChange={(v) => form.setValue("status", v as ProductFormValues["status"])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.value === "draft"
                          ? messages.statusDraft
                          : s.value === "active"
                            ? messages.statusActive
                            : messages.statusArchived}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.descriptionLabel}</Label>
              <Textarea
                {...form.register("description")}
                placeholder={messages.descriptionPlaceholder}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.sellCurrencyLabel}</Label>
                <Input
                  {...form.register("sellCurrency")}
                  placeholder="EUR"
                  maxLength={3}
                  className="uppercase"
                />
                {form.formState.errors.sellCurrency && (
                  <p className="text-xs text-destructive">{messages.validationIsoCurrency}</p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.travelDatesLabel}</Label>
                <DateRangePicker
                  value={{
                    from: form.watch("startDate") || null,
                    to: form.watch("endDate") || null,
                  }}
                  onChange={(nextValue) => {
                    form.setValue("startDate", nextValue?.from ?? "", { shouldDirty: true })
                    form.setValue("endDate", nextValue?.to ?? "", { shouldDirty: true })
                  }}
                  placeholder={messages.travelDatesPlaceholder}
                  className="w-full"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 max-w-[200px]">
              <Label>{messages.paxLabel}</Label>
              <Input
                {...form.register("pax")}
                type="number"
                min="1"
                placeholder={messages.paxPlaceholder}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {messages.cancel}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? messages.saveChanges : messages.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
