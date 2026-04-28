import { useProductOptionMutation } from "@voyantjs/products-react"
import {
  Button,
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
import { useAdminMessages } from "@/lib/admin-i18n"
import { zodResolver } from "@/lib/zod-resolver"

type OptionMessages = ReturnType<typeof useAdminMessages>["products"]["operations"]["options"]

const buildOptionFormSchema = (messages: OptionMessages) =>
  z.object({
    name: z.string().min(1, messages.validationNameRequired).max(255),
    code: z.string().max(100).optional().nullable(),
    description: z.string().optional().nullable(),
    status: z.enum(["draft", "active", "archived"]),
    isDefault: z.boolean(),
    sortOrder: z.coerce.number().int(),
    availableFrom: z.string().optional().nullable(),
    availableTo: z.string().optional().nullable(),
  })

type OptionFormSchema = ReturnType<typeof buildOptionFormSchema>
type OptionFormValues = z.input<OptionFormSchema>
type OptionFormOutput = z.output<OptionFormSchema>

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

export interface OptionFormProps {
  productId: string
  option?: ProductOptionData
  nextSortOrder?: number
  onSuccess: () => void
  onCancel?: () => void
}

export function OptionForm({
  productId,
  option,
  nextSortOrder,
  onSuccess,
  onCancel,
}: OptionFormProps) {
  const messages = useAdminMessages()
  const productMessages = messages.products.core
  const optionMessages = messages.products.operations.options
  const isEditing = !!option
  const { create, update } = useProductOptionMutation()
  const optionFormSchema = buildOptionFormSchema(optionMessages)
  const statuses = [
    { value: "draft", label: optionMessages.statusDraft },
    { value: "active", label: optionMessages.statusActive },
    { value: "archived", label: optionMessages.statusArchived },
  ] as const

  const form = useForm<OptionFormValues, unknown, OptionFormOutput>({
    resolver: zodResolver(optionFormSchema),
    defaultValues: option
      ? {
          name: option.name,
          code: option.code ?? "",
          description: option.description ?? "",
          status: option.status,
          isDefault: option.isDefault,
          sortOrder: option.sortOrder,
          availableFrom: option.availableFrom ?? "",
          availableTo: option.availableTo ?? "",
        }
      : {
          name: "",
          code: "",
          description: "",
          status: "draft",
          isDefault: false,
          sortOrder: nextSortOrder ?? 0,
          availableFrom: "",
          availableTo: "",
        },
  })

  useEffect(() => {
    if (option) {
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
    } else {
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
  }, [option, nextSortOrder, form])

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
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-1 flex-col gap-4 overflow-hidden"
    >
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label>{optionMessages.nameLabel}</Label>
            <Input {...form.register("name")} placeholder={optionMessages.namePlaceholder} />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label>{optionMessages.codeLabel}</Label>
            <Input {...form.register("code")} placeholder={optionMessages.codePlaceholder} />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label>{optionMessages.descriptionLabel}</Label>
          <Textarea {...form.register("description")} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label>{optionMessages.statusLabel}</Label>
            <Select
              value={form.watch("status")}
              onValueChange={(v) => form.setValue("status", v as OptionFormValues["status"])}
              items={statuses}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>{optionMessages.sortOrderLabel}</Label>
            <Input {...form.register("sortOrder")} type="number" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label>{optionMessages.availableFromLabel}</Label>
            <DatePicker
              value={
                typeof availableFrom === "string" && availableFrom.length > 0 ? availableFrom : null
              }
              onChange={(v) => form.setValue("availableFrom", v ?? "", { shouldDirty: true })}
              placeholder={optionMessages.optionalDatePlaceholder}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{optionMessages.availableToLabel}</Label>
            <DatePicker
              value={typeof availableTo === "string" && availableTo.length > 0 ? availableTo : null}
              onChange={(v) => form.setValue("availableTo", v ?? "", { shouldDirty: true })}
              placeholder={optionMessages.optionalDatePlaceholder}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            checked={form.watch("isDefault")}
            onCheckedChange={(v) => form.setValue("isDefault", v)}
          />
          <Label>{optionMessages.defaultLabel}</Label>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            {productMessages.cancel}
          </Button>
        ) : null}
        <Button
          type="submit"
          size="sm"
          disabled={form.formState.isSubmitting || create.isPending || update.isPending}
        >
          {(form.formState.isSubmitting || create.isPending || update.isPending) && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          {isEditing ? productMessages.saveChanges : optionMessages.create}
        </Button>
      </div>
    </form>
  )
}
