import { useProductOptionMutation } from "@voyantjs/products-react"
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
  Switch,
  Textarea,
} from "@voyantjs/ui/components"
import { DatePicker } from "@voyantjs/ui/components/date-picker"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { zodResolver } from "@/lib/zod-resolver"

const optionFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  code: z.string().max(100).optional().nullable(),
  description: z.string().optional().nullable(),
  status: z.enum(["draft", "active", "archived"]),
  isDefault: z.boolean(),
  sortOrder: z.coerce.number().int(),
  availableFrom: z.string().optional().nullable(),
  availableTo: z.string().optional().nullable(),
})

type OptionFormValues = z.input<typeof optionFormSchema>
type OptionFormOutput = z.output<typeof optionFormSchema>

export type ProductOptionData = {
  id: string
  productId: string
  name: string
  code: string | null
  description: string | null
  status: "draft" | "active" | "archived"
  isDefault: boolean
  sortOrder: number
  availableFrom: string | null
  availableTo: string | null
}

type OptionDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId: string
  option?: ProductOptionData
  nextSortOrder?: number
  onSuccess: () => void
}

const STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
] as const

export function OptionDialog({
  open,
  onOpenChange,
  productId,
  option,
  nextSortOrder,
  onSuccess,
}: OptionDialogProps) {
  const isEditing = !!option
  const { create, update } = useProductOptionMutation()

  const form = useForm<OptionFormValues, unknown, OptionFormOutput>({
    resolver: zodResolver(optionFormSchema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
      status: "draft",
      isDefault: false,
      sortOrder: 0,
      availableFrom: "",
      availableTo: "",
    },
  })

  useEffect(() => {
    if (open && option) {
      form.reset({
        name: option.name,
        code: option.code ?? "",
        description: option.description ?? "",
        status: option.status,
        isDefault: option.isDefault,
        sortOrder: option.sortOrder,
        availableFrom: option.availableFrom ?? "",
        availableTo: option.availableTo ?? "",
      })
    } else if (open) {
      form.reset({
        name: "",
        code: "",
        description: "",
        status: "draft",
        isDefault: false,
        sortOrder: nextSortOrder ?? 0,
        availableFrom: "",
        availableTo: "",
      })
    }
  }, [open, option, nextSortOrder, form])

  const onSubmit = async (values: OptionFormOutput) => {
    const payload = {
      name: values.name,
      code: values.code || null,
      description: values.description || null,
      status: values.status,
      isDefault: values.isDefault,
      sortOrder: values.sortOrder,
      availableFrom: values.availableFrom || null,
      availableTo: values.availableTo || null,
    }

    if (isEditing) {
      await update.mutateAsync({ id: option.id, input: payload })
    } else {
      await create.mutateAsync({ productId, ...payload })
    }
    onSuccess()
  }

  const availableFrom = form.watch("availableFrom")
  const availableTo = form.watch("availableTo")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Option" : "New Option"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Name</Label>
                <Input {...form.register("name")} placeholder="Single Room" />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label>Code</Label>
                <Input {...form.register("code")} placeholder="single" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Description</Label>
              <Textarea {...form.register("description")} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Status</Label>
                <Select
                  items={STATUSES}
                  value={form.watch("status")}
                  onValueChange={(v) => form.setValue("status", v as OptionFormValues["status"])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Sort order</Label>
                <Input {...form.register("sortOrder")} type="number" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Available from</Label>
                <DatePicker
                  value={
                    typeof availableFrom === "string" && availableFrom.length > 0
                      ? availableFrom
                      : null
                  }
                  onChange={(v) => form.setValue("availableFrom", v ?? "", { shouldDirty: true })}
                  placeholder="Optional"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Available to</Label>
                <DatePicker
                  value={
                    typeof availableTo === "string" && availableTo.length > 0 ? availableTo : null
                  }
                  onChange={(v) => form.setValue("availableTo", v ?? "", { shouldDirty: true })}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.watch("isDefault")}
                onCheckedChange={(v) => form.setValue("isDefault", v)}
              />
              <Label>Default option</Label>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={form.formState.isSubmitting || create.isPending || update.isPending}
            >
              {(form.formState.isSubmitting || create.isPending || update.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isEditing ? "Save Changes" : "Create Option"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
