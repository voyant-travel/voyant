import {
  type ProductExtraRecord,
  useProductExtraMutation,
  useProductExtras,
} from "@voyantjs/extras-react"
import { Badge, Button, Input, Label, Textarea } from "@voyantjs/ui/components"
import { Pencil, Plus, Trash2 } from "lucide-react"
import * as React from "react"
import { ActionMenu, EmptyState, Section } from "./product-detail-sections"

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
      title="Extras"
      actions={
        <Button variant="outline" size="sm" onClick={startCreate}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add extra
        </Button>
      }
      contentClassName="px-6 py-4"
    >
      {open ? (
        <div className="mb-4 grid gap-3 rounded-md border bg-muted/20 p-3">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Name">
              <Input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </Field>
            <Field label="Code">
              <Input
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value })}
              />
            </Field>
          </div>
          <Field label="Description">
            <Textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </Field>
          <div className="grid gap-3 md:grid-cols-5">
            <Field label="Selection">
              <select
                className="h-9 rounded-md border bg-background px-2 text-sm"
                value={form.selectionType}
                onChange={(event) =>
                  setForm({
                    ...form,
                    selectionType: event.target.value as FormState["selectionType"],
                  })
                }
              >
                {selectionTypes.map((type) => (
                  <option key={type} value={type}>
                    {type.replace("_", " ")}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Pricing">
              <select
                className="h-9 rounded-md border bg-background px-2 text-sm"
                value={form.pricingMode}
                onChange={(event) =>
                  setForm({ ...form, pricingMode: event.target.value as FormState["pricingMode"] })
                }
              >
                {pricingModes.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode.replace("_", " ")}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Default qty">
              <Input
                value={form.defaultQuantity}
                type="number"
                min="0"
                onChange={(event) => setForm({ ...form, defaultQuantity: event.target.value })}
              />
            </Field>
            <Field label="Min qty">
              <Input
                value={form.minQuantity}
                type="number"
                min="0"
                onChange={(event) => setForm({ ...form, minQuantity: event.target.value })}
              />
            </Field>
            <Field label="Max qty">
              <Input
                value={form.maxQuantity}
                type="number"
                min="0"
                onChange={(event) => setForm({ ...form, maxQuantity: event.target.value })}
              />
            </Field>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.pricedPerPerson}
                onChange={(event) => setForm({ ...form, pricedPerPerson: event.target.checked })}
              />
              Per traveler
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => setForm({ ...form, active: event.target.checked })}
              />
              Active
            </label>
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => void save()} disabled={!form.name.trim()}>
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {rows.length === 0 ? (
        <EmptyState message={isPending ? "Loading extras..." : "No extras configured yet."} />
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
                    {extra.active ? "Active" : "Inactive"}
                  </Badge>
                  <Badge variant="secondary">{extra.pricingMode.replace("_", " ")}</Badge>
                  {extra.pricedPerPerson ? <Badge variant="outline">per traveler</Badge> : null}
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
                  Edit
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-destructive text-sm"
                  onClick={() => {
                    if (confirm(`Delete extra "${extra.name}"?`))
                      remove.mutate(extra.id, { onSuccess: () => void refetch() })
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </ActionMenu>
            </div>
          ))}
        </div>
      )}
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
