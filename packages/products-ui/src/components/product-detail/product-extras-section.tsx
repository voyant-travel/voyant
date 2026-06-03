import {
  type ProductExtraRecord,
  useProductExtraMutation,
  useProductExtras,
} from "@voyantjs/extras-react"
import { formatMessage } from "@voyantjs/i18n"
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
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
import { Pencil, Plus, Trash2 } from "lucide-react"
import * as React from "react"
import { useProductDetailMessages } from "./host.js"
import { ActionMenu, EmptyState, Section } from "./product-detail-sections.js"

const selectionTypes = ["optional", "required", "default_selected", "unavailable"] as const
const pricingModes = [
  "included",
  "per_person",
  "per_booking",
  "quantity_based",
  "on_request",
  "free",
] as const

type FormState = {
  name: string
  code: string
  description: string
  selectionType: (typeof selectionTypes)[number]
  pricingMode: (typeof pricingModes)[number]
  pricedPerPerson: boolean
  minQuantity: string
  maxQuantity: string
  defaultQuantity: string
  active: boolean
}

const emptyForm: FormState = {
  name: "",
  code: "",
  description: "",
  selectionType: "optional",
  pricingMode: "per_booking",
  pricedPerPerson: false,
  minQuantity: "",
  maxQuantity: "",
  defaultQuantity: "",
  active: true,
}

export function ProductExtrasSection({ productId }: { productId: string }) {
  const messages = useProductDetailMessages()
  const extraMessages = messages.products.operations.extras
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ProductExtraRecord | null>(null)
  const [form, setForm] = React.useState<FormState>(emptyForm)
  const { data, isPending, refetch } = useProductExtras({ productId, limit: 100 })
  const { create, update, remove } = useProductExtraMutation()
  const rows = data?.data ?? []

  const startCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setOpen(true)
  }
  const startEdit = (extra: ProductExtraRecord) => {
    setEditing(extra)
    setForm({
      name: extra.name,
      code: extra.code ?? "",
      description: extra.description ?? "",
      selectionType: extra.selectionType,
      pricingMode: extra.pricingMode,
      pricedPerPerson: extra.pricedPerPerson,
      minQuantity: extra.minQuantity == null ? "" : String(extra.minQuantity),
      maxQuantity: extra.maxQuantity == null ? "" : String(extra.maxQuantity),
      defaultQuantity: extra.defaultQuantity == null ? "" : String(extra.defaultQuantity),
      active: extra.active,
    })
    setOpen(true)
  }
  const save = async () => {
    const payload = {
      productId,
      name: form.name.trim(),
      code: form.code.trim() || null,
      description: form.description.trim() || null,
      selectionType: form.selectionType,
      pricingMode: form.pricingMode,
      pricedPerPerson: form.pricedPerPerson,
      minQuantity: parseNullableInt(form.minQuantity),
      maxQuantity: parseNullableInt(form.maxQuantity),
      defaultQuantity: parseNullableInt(form.defaultQuantity),
      active: form.active,
      sortOrder: editing?.sortOrder ?? rows.length,
    }
    if (!payload.name) return
    if (editing) await update.mutateAsync({ id: editing.id, input: payload })
    else await create.mutateAsync(payload)
    setOpen(false)
    setEditing(null)
    setForm(emptyForm)
    void refetch()
  }

  return (
    <Section
      title={extraMessages.sectionTitle}
      actions={
        <Button variant="outline" size="sm" onClick={startCreate}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          {extraMessages.addAction}
        </Button>
      }
      contentClassName="px-6 py-4"
    >
      {rows.length === 0 ? (
        <EmptyState message={isPending ? extraMessages.loading : extraMessages.empty} />
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((extra) => (
            <div
              key={extra.id}
              className="flex items-start justify-between gap-3 rounded-md border px-3 py-2"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{extra.name}</span>
                  <Badge variant={extra.active ? "default" : "outline"}>
                    {extra.active ? extraMessages.activeBadge : extraMessages.inactiveBadge}
                  </Badge>
                  <Badge variant="secondary">
                    {getPricingModeLabel(extra.pricingMode, extraMessages)}
                  </Badge>
                  {extra.pricedPerPerson ? (
                    <Badge variant="outline">{extraMessages.perTravelerBadge}</Badge>
                  ) : null}
                </div>
                {extra.description ? (
                  <p className="text-muted-foreground text-xs">{extra.description}</p>
                ) : null}
              </div>
              <ActionMenu>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-sm"
                  onClick={() => startEdit(extra)}
                >
                  <Pencil className="h-4 w-4" />
                  {extraMessages.editAction}
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-destructive text-sm"
                  onClick={() => {
                    if (confirm(formatMessage(extraMessages.deleteConfirm, { name: extra.name })))
                      remove.mutate(extra.id, { onSuccess: () => void refetch() })
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  {extraMessages.deleteAction}
                </button>
              </ActionMenu>
            </div>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{editing ? extraMessages.editTitle : extraMessages.newTitle}</DialogTitle>
            <DialogDescription>{extraMessages.dialogDescription}</DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={extraMessages.nameLabel}>
                <Input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </Field>
              <Field label={extraMessages.codeLabel}>
                <Input
                  value={form.code}
                  onChange={(event) => setForm({ ...form, code: event.target.value })}
                />
              </Field>
            </div>
            <Field label={extraMessages.descriptionLabel}>
              <Textarea
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </Field>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label={extraMessages.selectionLabel}>
                <Select
                  value={form.selectionType}
                  onValueChange={(value) =>
                    setForm({
                      ...form,
                      selectionType: (value ?? "optional") as FormState["selectionType"],
                    })
                  }
                  items={selectionTypes.map((type) => ({
                    value: type,
                    label: getSelectionTypeLabel(type, extraMessages),
                  }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {selectionTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {getSelectionTypeLabel(type, extraMessages)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={extraMessages.pricingLabel}>
                <Select
                  value={form.pricingMode}
                  onValueChange={(value) =>
                    setForm({
                      ...form,
                      pricingMode: (value ?? "per_booking") as FormState["pricingMode"],
                    })
                  }
                  items={pricingModes.map((mode) => ({
                    value: mode,
                    label: getPricingModeLabel(mode, extraMessages),
                  }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pricingModes.map((mode) => (
                      <SelectItem key={mode} value={mode}>
                        {getPricingModeLabel(mode, extraMessages)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={extraMessages.defaultQuantityLabel}>
                <Input
                  value={form.defaultQuantity}
                  type="number"
                  min="0"
                  onChange={(event) => setForm({ ...form, defaultQuantity: event.target.value })}
                />
              </Field>
              <Field label={extraMessages.minQuantityLabel}>
                <Input
                  value={form.minQuantity}
                  type="number"
                  min="0"
                  onChange={(event) => setForm({ ...form, minQuantity: event.target.value })}
                />
              </Field>
              <Field label={extraMessages.maxQuantityLabel}>
                <Input
                  value={form.maxQuantity}
                  type="number"
                  min="0"
                  onChange={(event) => setForm({ ...form, maxQuantity: event.target.value })}
                />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2 text-sm">
                <Checkbox
                  id="product-extra-priced-per-person"
                  checked={form.pricedPerPerson}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, pricedPerPerson: checked === true })
                  }
                />
                <Label htmlFor="product-extra-priced-per-person">
                  {extraMessages.perTravelerLabel}
                </Label>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Checkbox
                  id="product-extra-active"
                  checked={form.active}
                  onCheckedChange={(checked) => setForm({ ...form, active: checked === true })}
                />
                <Label htmlFor="product-extra-active">{extraMessages.activeLabel}</Label>
              </div>
            </div>
          </DialogBody>
          <DialogFooter className="-mx-6 -mb-6">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {extraMessages.cancel}
            </Button>
            <Button onClick={() => void save()} disabled={!form.name.trim()}>
              {editing ? extraMessages.saveChanges : extraMessages.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function parseNullableInt(value: string): number | null {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

type ExtraMessages = ReturnType<typeof useProductDetailMessages>["products"]["operations"]["extras"]

function getSelectionTypeLabel(value: FormState["selectionType"], messages: ExtraMessages) {
  switch (value) {
    case "optional":
      return messages.selectionOptional
    case "required":
      return messages.selectionRequired
    case "default_selected":
      return messages.selectionDefaultSelected
    case "unavailable":
      return messages.selectionUnavailable
    default:
      return value
  }
}

function getPricingModeLabel(value: FormState["pricingMode"], messages: ExtraMessages) {
  switch (value) {
    case "included":
      return messages.pricingIncluded
    case "per_person":
      return messages.pricingPerPerson
    case "per_booking":
      return messages.pricingPerBooking
    case "quantity_based":
      return messages.pricingQuantityBased
    case "on_request":
      return messages.pricingOnRequest
    case "free":
      return messages.pricingFree
    default:
      return value
  }
}
