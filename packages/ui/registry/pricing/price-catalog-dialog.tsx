"use client"

import { type PriceCatalogRecord, usePriceCatalogMutation } from "@voyantjs/pricing-react"
import { usePricingUiMessagesOrDefault } from "@voyantjs/pricing-ui"
import { currencies } from "@voyantjs/utils/currencies"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"

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
} from "@/components/ui"
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { zodResolver } from "@/lib/zod-resolver"

import { useRegistryPricingMessagesOrDefault } from "./i18n"

const CURRENCY_CODES = Object.keys(currencies).sort()
const DEFAULT_CURRENCY_CODE = "EUR" // i18n-literal-ok ISO default currency

function createCatalogFormSchema(
  messages: ReturnType<typeof useRegistryPricingMessagesOrDefault>["priceCatalogDialog"],
) {
  return z.object({
    code: z.string().min(1, messages.validation.codeRequired).max(100),
    name: z.string().min(1, messages.validation.nameRequired).max(255),
    currencyCode: z
      .string()
      .length(3, messages.validation.currencyLength)
      .regex(/^[A-Z]{3}$/, messages.validation.currencyUppercase),
    catalogType: z.enum(["public", "contract", "net", "gross", "promo", "internal", "other"]),
    isDefault: z.boolean(),
    active: z.boolean(),
    notes: z.string().optional().nullable(),
  })
}

export interface PriceCatalogDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  catalog?: PriceCatalogRecord
  onSuccess?: (catalog: PriceCatalogRecord) => void
}

export function PriceCatalogDialog({
  open,
  onOpenChange,
  catalog,
  onSuccess,
}: PriceCatalogDialogProps) {
  const sharedMessages = usePricingUiMessagesOrDefault()
  const registryMessages = useRegistryPricingMessagesOrDefault()
  const dialogMessages = registryMessages.priceCatalogDialog
  const formSchema = createCatalogFormSchema(dialogMessages)
  const isEditing = !!catalog
  const { create, update } = usePriceCatalogMutation()

  type CatalogFormValues = z.input<typeof formSchema>
  type CatalogFormOutput = z.output<typeof formSchema>

  const catalogTypes = ["public", "contract", "net", "gross", "promo", "internal", "other"] as const

  const form = useForm<CatalogFormValues, unknown, CatalogFormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: "",
      name: "",
      currencyCode: DEFAULT_CURRENCY_CODE,
      catalogType: "public",
      isDefault: false,
      active: true,
      notes: "",
    },
  })

  useEffect(() => {
    if (open && catalog) {
      form.reset({
        code: catalog.code,
        name: catalog.name,
        currencyCode: catalog.currencyCode ?? "",
        catalogType: catalog.catalogType,
        isDefault: catalog.isDefault,
        active: catalog.active,
        notes: catalog.notes ?? "",
      })
    } else if (open) {
      form.reset()
    }
  }, [catalog, form, open])

  const onSubmit = async (values: CatalogFormOutput) => {
    const payload = {
      code: values.code,
      name: values.name,
      currencyCode: values.currencyCode,
      catalogType: values.catalogType,
      isDefault: values.isDefault,
      active: values.active,
      notes: values.notes || null,
    }

    const saved = isEditing
      ? await update.mutateAsync({ id: catalog.id, input: payload })
      : await create.mutateAsync(payload)

    onSuccess?.(saved)
    onOpenChange(false)
  }

  const isSubmitting = create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? dialogMessages.titles.edit : dialogMessages.titles.create}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.code}</Label>
                <Input {...form.register("code")} placeholder={dialogMessages.placeholders.code} />
                {form.formState.errors.code ? (
                  <p className="text-xs text-destructive">{form.formState.errors.code.message}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.name}</Label>
                <Input {...form.register("name")} placeholder={dialogMessages.placeholders.name} />
                {form.formState.errors.name ? (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.type}</Label>
                <Select
                  items={catalogTypes.map((value) => ({
                    label: dialogMessages.catalogTypeLabels[value],
                    value,
                  }))}
                  value={form.watch("catalogType")}
                  onValueChange={(value) =>
                    form.setValue("catalogType", value as CatalogFormValues["catalogType"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {catalogTypes.map((value) => (
                      <SelectItem key={value} value={value}>
                        {dialogMessages.catalogTypeLabels[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dialogMessages.fields.currency}</Label>
                <Combobox
                  items={CURRENCY_CODES}
                  value={form.watch("currencyCode") || null}
                  autoHighlight
                  filter={(code, query) => {
                    const currency = currencies[code as keyof typeof currencies]
                    if (!currency) return false
                    const value = query.toLowerCase()
                    return (
                      currency.code.toLowerCase().includes(value) ||
                      currency.name.toLowerCase().includes(value) ||
                      currency.symbol.toLowerCase().includes(value)
                    )
                  }}
                  onValueChange={(next) => {
                    if (typeof next === "string") {
                      form.setValue("currencyCode", next, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  }}
                >
                  <ComboboxInput placeholder={dialogMessages.placeholders.currencySearch} />
                  <ComboboxContent>
                    <ComboboxEmpty>{dialogMessages.placeholders.currencyEmpty}</ComboboxEmpty>
                    <ComboboxList>
                      <ComboboxCollection>
                        {(code: string) => {
                          const currency = currencies[code as keyof typeof currencies]
                          return (
                            <ComboboxItem key={code} value={code}>
                              <span className="min-w-10 font-mono text-xs text-muted-foreground">
                                {code}
                              </span>
                              <span className="truncate">{currency?.name ?? code}</span>
                            </ComboboxItem>
                          )
                        }}
                      </ComboboxCollection>
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
                {form.formState.errors.currencyCode ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.currencyCode.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("isDefault")}
                  onCheckedChange={(checked) => form.setValue("isDefault", checked)}
                />
                <Label>{dialogMessages.fields.defaultCatalog}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("active")}
                  onCheckedChange={(checked) => form.setValue("active", checked)}
                />
                <Label>{dialogMessages.fields.active}</Label>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{dialogMessages.fields.notes}</Label>
              <Textarea
                {...form.register("notes")}
                placeholder={dialogMessages.placeholders.notes}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {sharedMessages.common.cancel}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditing ? sharedMessages.common.saveChanges : dialogMessages.actions.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
