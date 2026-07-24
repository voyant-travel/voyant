"use client"

import {
  Badge,
  Button,
  confirmDialog,
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
} from "@voyant-travel/ui/components"
import { CurrencyCombobox } from "@voyant-travel/ui/components/currency-combobox"
import { cn } from "@voyant-travel/ui/lib/utils"
import { zodResolver } from "@voyant-travel/ui/lib/zod-resolver"
import { Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import { useEffect, useId, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { usePricingUiMessagesOrDefault } from "../i18n/index.js"
import type { PricingUiMessages } from "../i18n/messages.js"
import { type PriceCatalogRecord, usePriceCatalogMutation, usePriceCatalogs } from "../index.js"

const DEFAULT_PAGE_SIZE = 25

const CATALOG_TYPES = ["public", "contract", "net", "gross", "promo", "internal", "other"] as const

type PriceCatalogsPageMessages = PricingUiMessages["priceCatalogsPage"]

export interface PriceCatalogsPageProps {
  pageSize?: number
  className?: string
}

function getCatalogFormSchema(messages: PriceCatalogsPageMessages) {
  return z.object({
    name: z.string().min(1, messages.validation.nameRequired).max(255),
    code: z.string().min(1, messages.validation.codeRequired).max(100),
    currencyCode: z
      .string()
      .length(3, messages.validation.currencyLength)
      .optional()
      .nullable()
      .or(z.literal("")),
    catalogType: z.enum(CATALOG_TYPES),
    isDefault: z.boolean(),
    active: z.boolean(),
    notes: z.string().optional().nullable(),
  })
}

type CatalogFormSchema = ReturnType<typeof getCatalogFormSchema>
type CatalogFormValues = z.input<CatalogFormSchema>
type CatalogFormOutput = z.output<CatalogFormSchema>

export function PriceCatalogsPage({
  pageSize = DEFAULT_PAGE_SIZE,
  className,
}: PriceCatalogsPageProps = {}) {
  const messages = usePricingUiMessagesOrDefault()
  const pageMessages = messages.priceCatalogsPage
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<PriceCatalogRecord | undefined>()
  const [pageIndex, setPageIndex] = useState(0)
  const { data, isPending, refetch } = usePriceCatalogs({
    limit: pageSize,
    offset: pageIndex * pageSize,
  })
  const { remove } = usePriceCatalogMutation()

  const catalogs = data?.data ?? []
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div data-slot="price-catalogs-page" className={cn("flex flex-col gap-6", className)}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{pageMessages.title}</h2>
          <p className="text-sm text-muted-foreground">{pageMessages.description}</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined)
            setSheetOpen(true)
          }}
        >
          <Plus className="mr-1.5 size-3.5" />
          {pageMessages.addCatalog}
        </Button>
      </div>

      {isPending ? (
        <PriceCatalogsListLoading loadingLabel={messages.common.loading} />
      ) : (
        <div className="rounded-md border bg-card text-card-foreground shadow-sm">
          {catalogs.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">{pageMessages.empty}</p>
          ) : (
            <div className="flex flex-col divide-y">
              {catalogs.map((catalog) => (
                <div key={catalog.id} className="flex items-center justify-between gap-4 px-6 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{catalog.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{catalog.code}</span>
                    <Badge variant="outline" className="text-xs">
                      {catalog.currencyCode ?? messages.common.none}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {pageMessages.catalogTypeLabels[catalog.catalogType]}
                    </Badge>
                    {catalog.isDefault ? (
                      <Badge variant="default" className="text-xs">
                        {pageMessages.default}
                      </Badge>
                    ) : null}
                    {!catalog.active ? (
                      <Badge variant="secondary" className="text-xs">
                        {messages.common.inactive}
                      </Badge>
                    ) : null}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8 text-muted-foreground">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setEditing(catalog)
                          setSheetOpen(true)
                        }}
                      >
                        <Pencil className="size-4" />
                        {pageMessages.edit}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={async () => {
                          if (
                            await confirmDialog({
                              description: pageMessages.deleteConfirm,
                              destructive: true,
                            })
                          ) {
                            remove.mutate(catalog.id, { onSuccess: () => void refetch() })
                          }
                        }}
                      >
                        <Trash2 className="size-4" />
                        {pageMessages.delete}
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
          {pageMessages.showingSummary
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
            {messages.common.previous}
          </Button>
          <span>
            {messages.common.page} {pageIndex + 1} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={(pageIndex + 1) * pageSize >= total}
            onClick={() => setPageIndex((current) => current + 1)}
          >
            {messages.common.next}
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

function PriceCatalogsListLoading({ loadingLabel }: { loadingLabel: string }) {
  return (
    <div className="rounded-md border bg-card text-card-foreground shadow-sm">
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        {loadingLabel}
      </div>
    </div>
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
  const messages = usePricingUiMessagesOrDefault().priceCatalogsPage
  const { create, update } = usePriceCatalogMutation()
  const catalogFormSchema = useMemo(() => getCatalogFormSchema(messages), [messages])
  const fieldId = useId()

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

    if (catalog) {
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
          <SheetTitle>{catalog ? messages.editSheetTitle : messages.newSheetTitle}</SheetTitle>
        </SheetHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <SheetBody className="grid gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${fieldId}-name`}>{messages.nameLabel}</Label>
                <Input
                  id={`${fieldId}-name`}
                  {...form.register("name")}
                  placeholder={messages.namePlaceholder}
                  autoFocus
                />
                {form.formState.errors.name ? (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${fieldId}-code`}>{messages.codeLabel}</Label>
                <Input
                  id={`${fieldId}-code`}
                  {...form.register("code")}
                  placeholder={messages.codePlaceholder}
                />
                {form.formState.errors.code ? (
                  <p className="text-xs text-destructive">{form.formState.errors.code.message}</p>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${fieldId}-currency`}>{messages.currencyLabel}</Label>
                <CurrencyCombobox
                  id={`${fieldId}-currency`}
                  value={form.watch("currencyCode") ?? null}
                  onChange={(value) => form.setValue("currencyCode", value, { shouldDirty: true })}
                  emptyLabel={messages.noCurrenciesFound}
                  placeholder={messages.selectCurrencyPlaceholder}
                />
                {form.formState.errors.currencyCode ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.currencyCode.message}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.typeLabel}</Label>
                <Select
                  items={CATALOG_TYPES.map((value) => ({
                    value,
                    label: messages.catalogTypeLabels[value],
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
                    {CATALOG_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {messages.catalogTypeLabels[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("isDefault")}
                  onCheckedChange={(checked) => form.setValue("isDefault", checked)}
                />
                <Label>{messages.defaultCatalogLabel}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("active")}
                  onCheckedChange={(checked) => form.setValue("active", checked)}
                />
                <Label>{messages.activeLabel}</Label>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor={`${fieldId}-notes`}>{messages.notesLabel}</Label>
              <Input
                id={`${fieldId}-notes`}
                {...form.register("notes")}
                placeholder={messages.notesPlaceholder}
              />
            </div>
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              {messages.cancel}
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {catalog ? messages.saveChanges : messages.createCatalog}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
