"use client"

import {
  type ProductTypeRecord,
  useProductTypeMutation,
  useProductTypes,
} from "@voyantjs/products-react"
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
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Switch,
  Textarea,
} from "@voyantjs/ui/components"
import { Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { SettingsListSkeleton } from "@/components/voyant/settings/settings-list-skeleton"
import { type AdminMessages, useAdminMessages } from "@/lib/admin-i18n"
import { zodResolver } from "@/lib/zod-resolver"

const PAGE_SIZE = 25

function getFormSchema(messages: AdminMessages) {
  return z.object({
    name: z.string().min(1, messages.settings.validationNameRequired).max(255),
    code: z.string().min(1, messages.settings.validationCodeRequired).max(100),
    description: z.string().optional().nullable(),
    sortOrder: z.coerce.number().int().default(0),
    active: z.boolean().default(true),
  })
}

type FormSchema = ReturnType<typeof getFormSchema>
type FormValues = z.input<FormSchema>
type FormOutput = z.output<FormSchema>

export function ProductTypesPage() {
  const messages = useAdminMessages()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<ProductTypeRecord | undefined>()
  const [pageIndex, setPageIndex] = useState(0)
  const { data, isPending, refetch } = useProductTypes({
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
  })
  const { remove } = useProductTypeMutation()

  const items = data?.data ?? []
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            {messages.settings.productTypesPage.title}
          </h2>
          <p className="text-sm text-muted-foreground">
            {messages.settings.productTypesPage.description}
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
          {messages.settings.productTypesPage.addType}
        </Button>
      </div>

      {isPending ? (
        <SettingsListSkeleton rows={5} metaLines={1} />
      ) : (
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          {items.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {messages.settings.productTypesPage.empty}
            </p>
          ) : (
            <div className="flex flex-col divide-y">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between px-6 py-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{item.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">{item.code}</span>
                      {!item.active ? (
                        <Badge variant="secondary" className="text-xs">
                          {messages.settings.productTypesPage.inactive}
                        </Badge>
                      ) : null}
                    </div>
                    {item.description ? (
                      <p className="text-xs text-muted-foreground">{item.description}</p>
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
                          setEditing(item)
                          setSheetOpen(true)
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                        {messages.settings.productTypesPage.edit}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => {
                          if (confirm(messages.settings.productTypesPage.deleteConfirm)) {
                            remove.mutate(item.id, { onSuccess: () => void refetch() })
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        {messages.settings.productTypesPage.delete}
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
            .replace("{count}", String(items.length))
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

      <ProductTypeSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        item={editing}
        onSuccess={() => {
          setSheetOpen(false)
          setEditing(undefined)
          void refetch()
        }}
      />
    </div>
  )
}

function ProductTypeSheet({
  open,
  onOpenChange,
  item,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  item?: ProductTypeRecord
  onSuccess: () => void
}) {
  const messages = useAdminMessages()
  const isEditing = !!item
  const { create, update } = useProductTypeMutation()
  const formSchema = useMemo(() => getFormSchema(messages), [messages])

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
      sortOrder: 0,
      active: true,
    },
  })

  useEffect(() => {
    if (open && item) {
      form.reset({
        name: item.name,
        code: item.code,
        description: item.description ?? "",
        sortOrder: item.sortOrder,
        active: item.active,
      })
    } else if (open) {
      form.reset()
    }
  }, [open, item, form])

  const isSubmitting = create.isPending || update.isPending

  const onSubmit = async (values: FormOutput) => {
    const payload = {
      name: values.name,
      code: values.code,
      description: values.description || null,
      sortOrder: values.sortOrder,
      active: values.active,
    }

    if (isEditing) {
      await update.mutateAsync({ id: item.id, input: payload })
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
              ? messages.settings.productTypesPage.editSheetTitle
              : messages.settings.productTypesPage.newSheetTitle}
          </SheetTitle>
        </SheetHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <SheetBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.settings.productTypesPage.nameLabel}</Label>
                <Input
                  {...form.register("name")}
                  placeholder={messages.settings.productTypesPage.namePlaceholder}
                  autoFocus
                />
                {form.formState.errors.name ? (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label>{messages.settings.productTypesPage.codeLabel}</Label>
                <Input
                  {...form.register("code")}
                  placeholder={messages.settings.productTypesPage.codePlaceholder}
                />
                {form.formState.errors.code ? (
                  <p className="text-xs text-destructive">{form.formState.errors.code.message}</p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{messages.settings.productTypesPage.descriptionLabel}</Label>
              <Textarea
                {...form.register("description")}
                placeholder={messages.settings.productTypesPage.descriptionPlaceholder}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>{messages.settings.productTypesPage.sortOrderLabel}</Label>
                <Input {...form.register("sortOrder")} type="number" />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch
                  checked={form.watch("active")}
                  onCheckedChange={(checked) => form.setValue("active", checked)}
                />
                <Label>{messages.settings.productTypesPage.activeLabel}</Label>
              </div>
            </div>
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              {messages.settings.productTypesPage.cancel}
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditing
                ? messages.settings.productTypesPage.saveChanges
                : messages.settings.productTypesPage.createType}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
