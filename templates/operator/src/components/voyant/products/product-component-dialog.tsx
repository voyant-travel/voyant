import {
  type CreateProductComponentInput,
  type ProductComponentRecord,
  type UpdateProductComponentInput,
  useProductComponentMutation,
} from "@voyantjs/products-react"
import {
  Button,
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
  SheetHeader,
  SheetTitle,
  Switch,
  Textarea,
} from "@voyantjs/ui/components"
import { Loader2, Plus, X } from "lucide-react"
import { useEffect, useState } from "react"
import {
  type ComponentChoiceFormValue,
  type ComponentFormValues,
  componentToFormValues,
  formValuesToPayload,
  slugify,
  uniqueChoiceId,
} from "./product-component-form-utils"

const componentKindLabels: Record<ProductComponentRecord["componentKind"], string> = {
  accommodation: "Accommodation",
  transport: "Transport",
  activity: "Activity",
  meal: "Meal",
  insurance: "Insurance",
  other: "Other",
}

const selectionLabels: Record<ProductComponentRecord["selection"], string> = {
  fixed: "Fixed",
  choose_one: "Choose one",
  multi: "Multiple",
  optional: "Optional",
}

export function ProductComponentDialog({
  open,
  onOpenChange,
  productId,
  component,
  sortOrder,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId: string
  component?: ProductComponentRecord
  sortOrder: number
  onSuccess: () => void
}) {
  const isEditing = !!component

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="lg">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Edit component" : "New component"}</SheetTitle>
        </SheetHeader>
        <SheetBody>
          <ProductComponentForm
            productId={productId}
            component={component}
            sortOrder={sortOrder}
            onSuccess={onSuccess}
            onCancel={() => onOpenChange(false)}
          />
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}

function ProductComponentForm({
  productId,
  component,
  sortOrder,
  onSuccess,
  onCancel,
}: {
  productId: string
  component?: ProductComponentRecord
  sortOrder: number
  onSuccess: () => void
  onCancel: () => void
}) {
  const mutation = useProductComponentMutation()
  const [values, setValues] = useState<ComponentFormValues>(() =>
    componentToFormValues(component, sortOrder),
  )
  const isEditing = !!component
  const saving = mutation.create.isPending || mutation.update.isPending

  useEffect(() => {
    setValues(componentToFormValues(component, sortOrder))
  }, [component, sortOrder])

  function update<K extends keyof ComponentFormValues>(key: K, value: ComponentFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function updateChoice(index: number, patch: Partial<ComponentChoiceFormValue>) {
    setValues((current) => ({
      ...current,
      choices: current.choices.map((choice, choiceIndex) =>
        choiceIndex === index ? { ...choice, ...patch } : choice,
      ),
    }))
  }

  function submit() {
    const payload = formValuesToPayload(values)
    if (!payload) return

    if (component) {
      mutation.update.mutate(
        {
          id: component.id,
          input: payload satisfies UpdateProductComponentInput,
        },
        { onSuccess },
      )
      return
    }

    mutation.create.mutate(
      {
        productId,
        ...payload,
      } satisfies CreateProductComponentInput & { productId: string },
      { onSuccess },
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Kind</Label>
          <Select
            value={values.componentKind}
            onValueChange={(value) =>
              update("componentKind", value as ProductComponentRecord["componentKind"])
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(componentKindLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Selection</Label>
          <Select
            value={values.selection}
            onValueChange={(value) =>
              update("selection", value as ProductComponentRecord["selection"])
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(selectionLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label>Title</Label>
          <Input value={values.title} onChange={(event) => update("title", event.target.value)} />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label>Summary</Label>
          <Input
            value={values.summary}
            onChange={(event) => update("summary", event.target.value)}
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label>Description</Label>
          <Textarea
            value={values.description}
            onChange={(event) => update("description", event.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Commitment</Label>
          <Select
            value={values.commitmentBoundary}
            onValueChange={(value) =>
              update("commitmentBoundary", value as ProductComponentRecord["commitmentBoundary"])
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="internal">Internal</SelectItem>
              <SelectItem value="dependent_component">Dependent</SelectItem>
              <SelectItem value="independent_component">Independent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Price disposition</Label>
          <Select
            value={values.priceDisposition}
            onValueChange={(value) =>
              update("priceDisposition", value as ProductComponentRecord["priceDisposition"])
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="included">Included</SelectItem>
              <SelectItem value="add_on">Add-on</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Quantity</Label>
          <Input
            inputMode="numeric"
            value={values.quantity}
            onChange={(event) => update("quantity", event.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Sort order</Label>
          <Input
            inputMode="numeric"
            value={values.sortOrder}
            onChange={(event) => update("sortOrder", event.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 sm:col-span-2">
          <Switch
            checked={values.required}
            onCheckedChange={(checked) => update("required", checked)}
          />
          <span className="text-sm">Required</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Choices</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              update("choices", [
                ...values.choices,
                {
                  id: uniqueChoiceId("choice", values.choices),
                  title: "",
                  description: "",
                  isDefault: false,
                  sortOrder: String(values.choices.length),
                },
              ])
            }
          >
            <Plus className="mr-2 size-4" aria-hidden="true" />
            Add choice
          </Button>
        </div>

        {values.choices.length === 0 ? (
          <p className="rounded-md border px-3 py-4 text-sm text-muted-foreground">No choices.</p>
        ) : (
          values.choices.map((choice, index) => (
            <div key={choice.id} className="grid gap-3 rounded-md border p-3">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px_auto] sm:items-end">
                <div className="space-y-1.5">
                  <Label>Choice title</Label>
                  <Input
                    value={choice.title}
                    onChange={(event) => {
                      const title = event.target.value
                      updateChoice(index, {
                        title,
                        id: choice.id || uniqueChoiceId(slugify(title) || "choice", values.choices),
                      })
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Sort</Label>
                  <Input
                    inputMode="numeric"
                    value={choice.sortOrder}
                    onChange={(event) => updateChoice(index, { sortOrder: event.target.value })}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    update(
                      "choices",
                      values.choices.filter((_, choiceIndex) => choiceIndex !== index),
                    )
                  }
                  aria-label="Remove choice"
                >
                  <X className="size-4" aria-hidden="true" />
                </Button>
              </div>
              <div className="space-y-1.5">
                <Label>Choice description</Label>
                <Textarea
                  value={choice.description}
                  onChange={(event) => updateChoice(index, { description: event.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={choice.isDefault}
                  onCheckedChange={(checked) => updateChoice(index, { isDefault: checked })}
                />
                <span className="text-sm">Default choice</span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" disabled={saving || !values.title.trim()} onClick={submit}>
          {saving ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> : null}
          {isEditing ? "Save component" : "Create component"}
        </Button>
      </div>
    </div>
  )
}
