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
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@voyantjs/ui/components/combobox"
import { currencies } from "@voyantjs/utils/currencies"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { api } from "@/lib/api-client"
import { zodResolver } from "@/lib/zod-resolver"

const CURRENCY_CODES = Object.keys(currencies).sort()

const productFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  status: z.enum(["draft", "active", "archived"]),
  description: z.string().optional().nullable(),
  sellCurrency: z.string().min(3).max(3, "Use 3-letter ISO code"),
  sellAmount: z.coerce.number().min(0).optional().or(z.literal("")).nullable(),
  costAmount: z.coerce.number().min(0).optional().or(z.literal("")).nullable(),
})

type ProductFormValues = z.input<typeof productFormSchema>
type ProductFormOutput = z.output<typeof productFormSchema>

type ProductData = {
  id: string
  name: string
  status: "draft" | "active" | "archived"
  description: string | null
  sellCurrency: string
  sellAmountCents: number | null
  costAmountCents: number | null
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

  const form = useForm<ProductFormValues, unknown, ProductFormOutput>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      status: "draft",
      description: "",
      sellCurrency: "EUR",
      sellAmount: "",
      costAmount: "",
    },
  })

  useEffect(() => {
    if (open && product) {
      form.reset({
        name: product.name,
        status: product.status,
        description: product.description ?? "",
        sellCurrency: product.sellCurrency,
        sellAmount: product.sellAmountCents != null ? product.sellAmountCents / 100 : "",
        costAmount: product.costAmountCents != null ? product.costAmountCents / 100 : "",
      })
    } else if (open) {
      form.reset()
    }
  }, [open, product, form])

  const onSubmit = async (values: ProductFormOutput) => {
    const sellAmountCents =
      values.sellAmount && typeof values.sellAmount === "number"
        ? Math.round(values.sellAmount * 100)
        : null
    const costAmountCents =
      values.costAmount && typeof values.costAmount === "number"
        ? Math.round(values.costAmount * 100)
        : null
    const payload = {
      name: values.name,
      status: values.status,
      description: values.description || null,
      sellCurrency: values.sellCurrency,
      sellAmountCents,
      costAmountCents,
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
          <DialogTitle>{isEditing ? "Edit Product" : "New Product"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Name</Label>
                <Input {...form.register("name")} placeholder="Croatia Explorer 2026" />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label>Status</Label>
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
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Description</Label>
              <Textarea
                {...form.register("description")}
                placeholder="Brief overview of the product..."
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Sell Currency</Label>
                <Combobox
                  items={CURRENCY_CODES}
                  value={form.watch("sellCurrency") || null}
                  autoHighlight
                  filter={(code, query) => {
                    const c = currencies[code as keyof typeof currencies]
                    if (!c) return false
                    const q = query.toLowerCase()
                    return (
                      c.code.toLowerCase().includes(q) ||
                      c.name.toLowerCase().includes(q) ||
                      c.symbol.toLowerCase().includes(q)
                    )
                  }}
                  onValueChange={(next) => {
                    if (typeof next === "string") {
                      form.setValue("sellCurrency", next, {
                        shouldValidate: true,
                        shouldDirty: true,
                      })
                    }
                  }}
                >
                  <ComboboxInput placeholder="Search currency…" />
                  <ComboboxContent>
                    <ComboboxEmpty>No currencies found</ComboboxEmpty>
                    <ComboboxList>
                      <ComboboxCollection>
                        {(code: string) => {
                          const c = currencies[code as keyof typeof currencies]
                          return (
                            <ComboboxItem key={code} value={code}>
                              <span className="min-w-10 font-mono text-xs text-muted-foreground">
                                {code}
                              </span>
                              <span className="truncate">{c?.name ?? code}</span>
                            </ComboboxItem>
                          )
                        }}
                      </ComboboxCollection>
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
                {form.formState.errors.sellCurrency && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.sellCurrency.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label>Sell Amount</Label>
                <Input
                  {...form.register("sellAmount")}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Cost Amount</Label>
                <Input
                  {...form.register("costAmount")}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Departures and capacity are managed under the Availability section of the product.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Create Product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
