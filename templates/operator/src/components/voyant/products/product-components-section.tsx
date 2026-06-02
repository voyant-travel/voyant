import {
  type OptionUnitRecord,
  type ProductComponentChoiceRecord,
  type ProductComponentRecord,
  type ProductOptionRecord,
  useOptionUnits,
  useProductComponentMutation,
  useProductComponents,
  useProductOptions,
} from "@voyantjs/products-react"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voyantjs/ui/components"
import { Loader2, Pencil, Plus, Save, Trash2, Upload } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { ProductComponentDialog } from "./product-component-dialog"
import { ProductComponentImportDialog } from "./product-component-import-dialog"

const NONE_VALUE = "__none"

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

export function ProductComponentsSection({ productId }: { productId: string }) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [editingComponent, setEditingComponent] = useState<ProductComponentRecord | undefined>()
  const componentsQuery = useProductComponents({ productId, limit: 100 })
  const optionsQuery = useProductOptions({ productId, status: "active", limit: 100 })
  const components = useMemo(
    () => (componentsQuery.data?.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder),
    [componentsQuery.data?.data],
  )
  const options = useMemo(
    () => (optionsQuery.data?.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder),
    [optionsQuery.data?.data],
  )

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <CardTitle>Components</CardTitle>
          <CardDescription>
            Maintain package component choices and map bookable choices to product option pricing.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <Upload className="mr-2 size-4" aria-hidden="true" />
            Import
          </Button>
          <Button
            onClick={() => {
              setEditingComponent(undefined)
              setDialogOpen(true)
            }}
          >
            <Plus className="mr-2 size-4" aria-hidden="true" />
            Add component
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {componentsQuery.isPending ? (
          <div className="flex min-h-24 items-center justify-center">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : componentsQuery.isError ? (
          <p className="text-sm text-destructive">Failed to load product components.</p>
        ) : components.length === 0 ? (
          <p className="rounded-md border px-3 py-4 text-sm text-muted-foreground">
            No components yet.
          </p>
        ) : (
          components.map((component) => (
            <ComponentCard
              key={component.id}
              component={component}
              options={options}
              optionsPending={optionsQuery.isPending}
              onEdit={() => {
                setEditingComponent(component)
                setDialogOpen(true)
              }}
            />
          ))
        )}
        <ProductComponentDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          productId={productId}
          component={editingComponent}
          sortOrder={
            components.length > 0
              ? Math.max(...components.map((component) => component.sortOrder)) + 1
              : 0
          }
          onSuccess={() => {
            setDialogOpen(false)
            setEditingComponent(undefined)
          }}
        />
        <ProductComponentImportDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          productId={productId}
          onSuccess={() => setImportDialogOpen(false)}
        />
      </CardContent>
    </Card>
  )
}

function ComponentCard({
  component,
  options,
  optionsPending,
  onEdit,
}: {
  component: ProductComponentRecord
  options: ProductOptionRecord[]
  optionsPending: boolean
  onEdit: () => void
}) {
  const mutation = useProductComponentMutation()

  return (
    <div className="rounded-md border">
      <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-medium">{component.title}</h3>
            <Badge variant="outline">{componentKindLabels[component.componentKind]}</Badge>
            <Badge variant="secondary">{selectionLabels[component.selection]}</Badge>
            {component.priceDisposition === "add_on" ? <Badge>Add-on</Badge> : null}
          </div>
          {component.summary ? (
            <p className="text-sm text-muted-foreground">{component.summary}</p>
          ) : null}
        </div>
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label="Edit component">
            <Pencil className="size-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              if (confirm(`Delete component "${component.title}"?`)) {
                mutation.remove.mutate(component.id)
              }
            }}
            aria-label="Delete component"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {component.choices.length === 0 ? (
        <p className="px-3 py-4 text-sm text-muted-foreground">
          This component does not expose selectable choices.
        </p>
      ) : (
        <div className="flex flex-col gap-3 p-3">
          {component.choices.map((choice) => (
            <ChoicePricingRefRow
              key={choice.id}
              component={component}
              choice={choice}
              options={options}
              optionsPending={optionsPending}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ChoicePricingRefRow({
  component,
  choice,
  options,
  optionsPending,
}: {
  component: ProductComponentRecord
  choice: ProductComponentChoiceRecord
  options: ProductOptionRecord[]
  optionsPending: boolean
}) {
  const mutation = useProductComponentMutation()
  const initialOptionId = choice.pricing_ref?.option_id ?? ""
  const initialUnitId = choice.pricing_ref?.option_unit_id ?? ""
  const [optionId, setOptionId] = useState(initialOptionId)
  const [unitId, setUnitId] = useState(initialUnitId)
  const unitsQuery = useOptionUnits({
    optionId,
    limit: 100,
    enabled: optionId.length > 0,
  })
  const units = useMemo(
    () => (unitsQuery.data?.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder),
    [unitsQuery.data?.data],
  )

  useEffect(() => {
    setOptionId(initialOptionId)
    setUnitId(initialUnitId)
  }, [initialOptionId, initialUnitId])

  useEffect(() => {
    if (!optionId) {
      setUnitId("")
      return
    }
    if (unitId && units.length > 0 && !units.some((unit) => unit.id === unitId)) {
      setUnitId("")
    }
  }, [optionId, unitId, units])

  const dirty = optionId !== initialOptionId || unitId !== initialUnitId
  const saving = mutation.update.isPending

  return (
    <div className="grid gap-3 rounded-md border bg-muted/20 p-3 lg:grid-cols-[minmax(0,1fr)_220px_220px_auto] lg:items-end">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium">{choice.title}</p>
          {choice.required ? <Badge variant="outline">Required</Badge> : null}
        </div>
        {choice.summary ? (
          <p className="mt-1 text-sm text-muted-foreground">{choice.summary}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label>Pricing option</Label>
        <Select
          value={optionId || NONE_VALUE}
          disabled={optionsPending}
          onValueChange={(value) => {
            const nextValue = value ?? NONE_VALUE
            const next = nextValue === NONE_VALUE ? "" : nextValue
            setOptionId(next)
            setUnitId("")
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select option" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_VALUE}>No option</SelectItem>
            {options.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Pricing unit</Label>
        <Select
          value={unitId || NONE_VALUE}
          disabled={!optionId || unitsQuery.isPending}
          onValueChange={(value) => {
            const nextValue = value ?? NONE_VALUE
            setUnitId(nextValue === NONE_VALUE ? "" : nextValue)
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select unit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_VALUE}>No unit</SelectItem>
            {units.map((unit: OptionUnitRecord) => (
              <SelectItem key={unit.id} value={unit.id}>
                {unit.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        variant="outline"
        disabled={!dirty || saving}
        onClick={() => {
          const nextChoices = component.choices.map((item) => {
            if (item.id !== choice.id) {
              return {
                ...item,
                metadata: item.metadata ?? undefined,
                pricing_ref: item.pricing_ref ?? undefined,
              }
            }
            const pricingRef =
              optionId || unitId
                ? {
                    ...(item.pricing_ref ?? {}),
                    option_id: optionId || null,
                    option_unit_id: unitId || null,
                  }
                : undefined
            return {
              ...item,
              metadata: item.metadata ?? undefined,
              pricing_ref: pricingRef,
            }
          })
          mutation.update.mutate({
            id: component.id,
            input: { choices: nextChoices },
          })
        }}
      >
        {saving ? (
          <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Save className="mr-2 size-4" aria-hidden="true" />
        )}
        Save
      </Button>
    </div>
  )
}
