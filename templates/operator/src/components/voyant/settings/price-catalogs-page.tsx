"use client"

import {
  type PriceCatalogRecord,
  usePriceCatalogMutation,
  usePriceCatalogs,
} from "@voyantjs/pricing-react"
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Switch,
} from "@voyantjs/ui/components"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@voyantjs/ui/components/combobox"
import { currencies } from "@voyantjs/utils/currencies"
import { Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { SettingsListSkeleton } from "@/components/voyant/settings/settings-list-skeleton"
import { type AdminMessages, useAdminMessages } from "@/lib/admin-i18n"
import { zodResolver } from "@/lib/zod-resolver"

const PAGE_SIZE = 25

const CURRENCY_OPTIONS = Object.values(currencies).map((currency) => ({
  value: currency.code,
  label: `${currency.code} — ${currency.name} (${currency.symbol})`,
}))

function getCatalogFormSchema(messages: AdminMessages) {
  return z.object({
    name: z.string().min(1, messages.settings.validationNameRequired).max(255),
    code: z.string().min(1, messages.settings.validationCodeRequired).max(100),
    currencyCode: z.string().length(3).optional().nullable().or(z.literal("")),
    catalogType: z.enum(["public", "contract", "net", "gross", "promo", "internal", "other"]),
    isDefault: z.boolean(),
    active: z.boolean(),
    notes: z.string().optional().nullable(),
  })
}

type CatalogFormSchema = ReturnType<typeof getCatalogFormSchema>
type CatalogFormValues = z.input<CatalogFormSchema>
type CatalogFormOutput = z.output<CatalogFormSchema>

export function PriceCatalogsPage() {
  const messages = useAdminMessages()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<PriceCatalogRecord | undefined>()
  const [pageIndex, setPageIndex] = useState(0)
  const { data, isPending, refetch } = usePriceCatalogs({
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
  })
  const { remove } = usePriceCatalogMutation()

  const catalogs = data?.data ?? []
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const catalogTypeLabels: Record<string, string> = {
    public: messages.settings.priceCatalogsPage.typePublic,
    contract: messages.settings.priceCatalogsPage.typeContract,
    net: messages.settings.priceCatalogsPage.typeNet,
    gross: messages.settings.priceCatalogsPage.typeGross,
    promo: messages.settings.priceCatalogsPage.typePromo,
    internal: messages.settings.priceCatalogsPage.typeInternal,
    other: messages.settings.priceCatalogsPage.typeOther,
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            {messages.settings.priceCatalogsPage.title}
          </h2>
          <p className="text-sm text-muted-foreground">
            {messages.settings.priceCatalogsPage.description}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined)
            setSheetOpen(true)
          }}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {messages.settings.priceCatalogsPage.addCatalog}
        </Button>
      </div>

      {isPending ? (
        <SettingsListSkeleton rows={5} />
      ) : (
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          {catalogs.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {messages.settings.priceCatalogsPage.empty}
            </p>
          ) : (
            <div className="flex flex-col divide-y">
              {catalogs.map((catalog) => (
                <div key={catalog.id} className="flex items-center justify-between px-6 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{catalog.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{catalog.code}</span>
                    <Badge variant="outline" className="text-xs">
                      {catalog.currencyCode}
                    </Badge>
                    <Badge variant="outline" className="text-xs capitalize">
                      {catalogTypeLabels[catalog.catalogType] ?? catalog.catalogType}
                    </Badge>
                    {catalog.isDefault ? (
                      <Badge variant="default" className="text-xs">
                        {messages.settings.priceCatalogsPage.default}
                      </Badge>
                    ) : null}
                    {!catalog.active ? (
                      <Badge variant="secondary" className="text-xs">
                        {messages.settings.priceCatalogsPage.inactive}
                      </Badge>
                    ) : null}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setEditing(catalog)
                          setSheetOpen(true)
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                        {messages.settings.priceCatalogsPage.edit}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => {
                          if (confirm(messages.settings.priceCatalogsPage.deleteConfirm)) {
                            remove.mutate(catalog.id, { onSuccess: () => void refetch() })
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        {messages.settings.priceCatalogsPage.delete}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {messages.settings.paginationShowing
            .replace("{count}", String(catalogs.length))
            .replace("{total}", String(total))}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pageIndex === 0}
            onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
          >
            {messages.settings.paginationPrevious}
          </Button>
          <span>
            {messages.settings.paginationPage
              .replace("{page}", String(pageIndex + 1))
              .replace("{pageCount}", String(pageCount))}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={(pageIndex + 1) * PAGE_SIZE >= total}
            onClick={() => setPageIndex((current) => current + 1)}
          >
            {messages.settings.paginationNext}
          </Button>
        </div>
      </div>

      <CatalogSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        catalog={editing}
        onSuccess={() => {
          setSheetOpen(false)
          setEditing(undefined)
          void refetch()
        }}
      />
    </div>
  )
}

function CurrencyCombobox({
  value,
  onChange,
  emptyLabel,
  inputPlaceholder,
}: {
  value: string
  onChange: (value: string) => void
  emptyLabel: string
  inputPlaceholder: string
}) {
  return (
    <Combobox
      items={CURRENCY_OPTIONS}
      value={value}
      onValueChange={(next) => onChange(String(next ?? ""))}
    >
      <ComboboxInput placeholder={inputPlaceholder} />
      <ComboboxContent>
        <ComboboxEmpty>{emptyLabel}</ComboboxEmpty>
        <ComboboxList>
          {CURRENCY_OPTIONS.map((option) => (
            <ComboboxItem key={option.value} value={option.value}>
              {option.label}
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

function CatalogSheet({
  open,
  onOpenChange,
  catalog,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  catalog?: PriceCatalogRecord
  onSuccess: () => void
}) {
  const messages = useAdminMessages()
  const isEditing = !!catalog
  const { create, update } = usePriceCatalogMutation()
  const catalogTypes = [
    { value: "public", label: messages.settings.priceCatalogsPage.typePublic },
    { value: "contract", label: messages.settings.priceCatalogsPage.typeContract },
    { value: "net", label: messages.settings.priceCatalogsPage.typeNet },
    { value: "gross", label: messages.settings.priceCatalogsPage.typeGross },
    { value: "promo", label: messages.settings.priceCatalogsPage.typePromo },
    { value: "internal", label: messages.settings.priceCatalogsPage.typeInternal },
    { value: "other", label: messages.settings.priceCatalogsPage.typeOther },
  ] as const
  const catalogFormSchema = useMemo(() => getCatalogFormSchema(messages), [messages])

  const form = useForm<CatalogFormValues, unknown, CatalogFormOutput>({
    resolver: zodResolver(catalogFormSchema),
    defaultValues: {
      name: "",
      code: "",
      currencyCode: "",
      catalogType: "public",
      isDefault: false,
      active: true,
      notes: "",
    },
  })

  useEffect(() => {
    if (open && catalog) {
      form.reset({
        name: catalog.name,
        code: catalog.code,
        currencyCode: catalog.currencyCode ?? "",
        catalogType: catalog.catalogType,
        isDefault: catalog.isDefault,
        active: catalog.active,
        notes: catalog.notes ?? "",
      })
    } else if (open) {
      form.reset()
    }
  }, [open, catalog, form])

  const isSubmitting = create.isPending || update.isPending

  const onSubmit = async (values: CatalogFormOutput) => {
    const payload = {
      name: values.name,
      code: values.code,
      currencyCode: values.currencyCode || null,
      catalogType: values.catalogType,
      isDefault: values.isDefault,
      active: values.active,
      notes: values.notes || null,
    }

    if (isEditing) {
      await update.mutateAsync({ id: catalog.id, input: payload })
    } else {
      await create.mutateAsync(payload)
    }
    onSuccess()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="lg">
        <SheetHeader>
          <SheetTitle>
            {isEditing
              ? messages.settings.priceCatalogsPage.editSheetTitle
              : messages.settings.priceCatalogsPage.newSheetTitle}
          </SheetTitle>
        </SheetHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <SheetBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.settings.priceCatalogsPage.nameLabel}</Label>
                <Input
                  {...form.register("name")}
                  placeholder={messages.settings.priceCatalogsPage.namePlaceholder}
                  autoFocus
                />
                {form.formState.errors.name ? (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.settings.priceCatalogsPage.codeLabel}</Label>
                <Input
                  {...form.register("code")}
                  placeholder={messages.settings.priceCatalogsPage.codePlaceholder}
                />
                {form.formState.errors.code ? (
                  <p className="text-xs text-destructive">{form.formState.errors.code.message}</p>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.settings.priceCatalogsPage.currencyLabel}</Label>
                <CurrencyCombobox
                  value={form.watch("currencyCode") ?? ""}
                  onChange={(value) =>
                    form.setValue("currencyCode", value || null, { shouldDirty: true })
                  }
                  emptyLabel={messages.settings.priceCatalogsPage.noCurrenciesFound}
                  inputPlaceholder={messages.settings.priceCatalogsPage.selectCurrencyPlaceholder}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.settings.priceCatalogsPage.typeLabel}</Label>
                <Select
                  items={catalogTypes}
                  value={form.watch("catalogType")}
                  onValueChange={(value) =>
                    form.setValue("catalogType", value as CatalogFormValues["catalogType"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {catalogTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("isDefault")}
                  onCheckedChange={(checked) => form.setValue("isDefault", checked)}
                />
                <Label>{messages.settings.priceCatalogsPage.defaultCatalogLabel}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("active")}
                  onCheckedChange={(checked) => form.setValue("active", checked)}
                />
                <Label>{messages.settings.priceCatalogsPage.activeLabel}</Label>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.settings.priceCatalogsPage.notesLabel}</Label>
              <Input
                {...form.register("notes")}
                placeholder={messages.settings.priceCatalogsPage.notesPlaceholder}
              />
            </div>
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              {messages.settings.priceCatalogsPage.cancel}
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditing
                ? messages.settings.priceCatalogsPage.saveChanges
                : messages.settings.priceCatalogsPage.createCatalog}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
