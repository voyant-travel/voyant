import { useQuery } from "@tanstack/react-query"
import {
  type PriceCatalogRecord,
  type RatePlanMatrixImportInput,
  type RatePlanMatrixImportResponse,
  useRatePlanMatrixImportMutation,
} from "@voyantjs/pricing-react"
import {
  Button,
  Input,
  Label,
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Switch,
  Textarea,
} from "@voyantjs/ui/components"
import { Code2, Grid2X2, Loader2, Plus, Trash2, Upload } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import {
  getOptionUnitsQueryOptions,
  getPricingCategoriesQueryOptions,
} from "./product-options-shared"
import {
  buildDefaultPayload,
  buildGridPayload,
  type CategoryType,
  categoryRecordToDraft,
  categoryTypes,
  cellKey,
  defaultCategories,
  defaultScheduleCode,
  type MatrixCategoryDraft,
  type MatrixCellDrafts,
  nextCategoryCode,
  normalizeCode,
  parsePastedMatrix,
  placeholderPayload,
  unitPlaceholder,
} from "./product-rate-plan-matrix-import-utils"

type ImportMode = "grid" | "json"

export function RatePlanMatrixImportDialog({
  open,
  onOpenChange,
  productId,
  optionId,
  priceCatalog,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId: string
  optionId: string
  priceCatalog: PriceCatalogRecord | null
  onSuccess: () => void
}) {
  const mutation = useRatePlanMatrixImportMutation()
  const unitsQuery = useQuery(getOptionUnitsQueryOptions(optionId))
  const pricingCategoriesQuery = useQuery(getPricingCategoriesQueryOptions())
  const firstUnitId = unitsQuery.data?.data[0]?.id ?? unitPlaceholder
  const suggestedPayload = useMemo(() => buildDefaultPayload(firstUnitId), [firstUnitId])
  const units = useMemo(
    () =>
      [...(unitsQuery.data?.data ?? [])].sort(
        (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
      ),
    [unitsQuery.data?.data],
  )
  const existingCategories = useMemo(
    () =>
      (pricingCategoriesQuery.data?.data ?? [])
        .filter((category) => category.active)
        .filter((category) => category.optionId === optionId || category.productId === productId)
        .slice(0, 8),
    [optionId, pricingCategoriesQuery.data?.data, productId],
  )
  const [mode, setMode] = useState<ImportMode>("grid")
  const [dryRun, setDryRun] = useState(true)
  const [payload, setPayload] = useState(placeholderPayload)
  const [scheduleCode, setScheduleCode] = useState(defaultScheduleCode)
  const [scheduleName, setScheduleName] = useState("Season 2026")
  const [recurrenceRule, setRecurrenceRule] = useState("FREQ=DAILY")
  const [ratePlanCode, setRatePlanCode] = useState("PACKAGE-MATRIX")
  const [ratePlanName, setRatePlanName] = useState("Package matrix")
  const [categories, setCategories] = useState<MatrixCategoryDraft[]>(defaultCategories)
  const [categoryEdited, setCategoryEdited] = useState(false)
  const [cellDrafts, setCellDrafts] = useState<MatrixCellDrafts>({})
  const [pasteValue, setPasteValue] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<RatePlanMatrixImportResponse | null>(null)
  const saving = mutation.isPending
  const buttonLabel = useMemo(() => {
    if (saving) return dryRun ? "Validating" : "Importing"
    return dryRun ? "Validate" : "Import"
  }, [dryRun, saving])

  useEffect(() => {
    setPayload((current) => (current === placeholderPayload ? suggestedPayload : current))
  }, [suggestedPayload])

  useEffect(() => {
    if (!open || categoryEdited || existingCategories.length === 0) return
    setCategories(existingCategories.map(categoryRecordToDraft))
  }, [categoryEdited, existingCategories, open])

  function submit() {
    setError(null)
    setResult(null)
    if (!priceCatalog) {
      setError("A price catalog is required before importing a matrix.")
      return
    }

    let parsed: unknown
    if (mode === "grid") {
      try {
        parsed = buildGridPayload({
          categories,
          cellDrafts,
          recurrenceRule,
          ratePlanCode,
          ratePlanName,
          scheduleCode,
          scheduleName,
          units,
        })
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Invalid matrix")
        return
      }
    } else {
      try {
        parsed = JSON.parse(payload)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Invalid JSON")
        return
      }
    }

    if (!parsed || typeof parsed !== "object") {
      setError("Payload must be a JSON object.")
      return
    }

    mutation.mutate(
      {
        ...(parsed as object),
        productId,
        optionId,
        priceCatalogId: priceCatalog.id,
        dryRun,
      } as RatePlanMatrixImportInput,
      {
        onSuccess: (response) => {
          setResult(response)
          if (!response.summary.dryRun) {
            onSuccess()
          }
        },
        onError: (cause) => {
          setError(cause instanceof Error ? cause.message : "Matrix import failed")
        },
      },
    )
  }

  function addCategory() {
    setCategoryEdited(true)
    setCategories((current) => [
      ...current,
      {
        localId: crypto.randomUUID(),
        code: nextCategoryCode(current),
        name: "New category",
        categoryType: "room",
        seatOccupancy: 1,
      },
    ])
  }

  function updateCategory(localId: string, input: Partial<MatrixCategoryDraft>) {
    setCategoryEdited(true)
    setCategories((current) =>
      current.map((category) =>
        category.localId === localId ? { ...category, ...input } : category,
      ),
    )
  }

  function removeCategory(localId: string) {
    setCategoryEdited(true)
    setCategories((current) => current.filter((category) => category.localId !== localId))
  }

  function updateCell(unitId: string, categoryCode: string, value: string) {
    setCellDrafts((current) => ({
      ...current,
      [cellKey(unitId, categoryCode)]: value,
    }))
  }

  function applyPastedMatrix() {
    setError(null)
    try {
      const parsed = parsePastedMatrix(pasteValue, units)
      setCategoryEdited(true)
      setCategories(parsed.categories)
      setCellDrafts((current) => ({ ...current, ...parsed.cells }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not parse pasted matrix")
    }
  }

  const generatedPayload = useMemo(() => {
    try {
      return JSON.stringify(
        buildGridPayload({
          categories,
          cellDrafts,
          recurrenceRule,
          ratePlanCode,
          ratePlanName,
          scheduleCode,
          scheduleName,
          units,
          allowEmptyPrices: true,
        }),
        null,
        2,
      )
    } catch (cause) {
      return cause instanceof Error ? cause.message : "Invalid matrix"
    }
  }, [
    categories,
    cellDrafts,
    recurrenceRule,
    ratePlanCode,
    ratePlanName,
    scheduleCode,
    scheduleName,
    units,
  ])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="lg" className="sm:max-w-5xl">
        <SheetHeader>
          <SheetTitle>Import rate-plan matrix</SheetTitle>
        </SheetHeader>
        <SheetBody>
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1 rounded-md border p-3 text-sm">
              <span className="font-medium">{priceCatalog?.name ?? "No price catalog"}</span>
              <span className="text-muted-foreground">
                {priceCatalog
                  ? `${priceCatalog.code} - ${priceCatalog.currencyCode ?? "product currency"}`
                  : "Create or activate a price catalog before importing."}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={dryRun} onCheckedChange={setDryRun} />
              <span className="text-sm">Dry run</span>
            </div>

            <div className="inline-flex w-fit rounded-md border p-1">
              <Button
                type="button"
                size="sm"
                variant={mode === "grid" ? "default" : "ghost"}
                onClick={() => setMode("grid")}
              >
                <Grid2X2 className="mr-2 size-4" aria-hidden="true" />
                Grid
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === "json" ? "default" : "ghost"}
                onClick={() => setMode("json")}
              >
                <Code2 className="mr-2 size-4" aria-hidden="true" />
                JSON
              </Button>
            </div>

            {mode === "grid" ? (
              <div className="flex flex-col gap-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Schedule code</Label>
                    <Input
                      value={scheduleCode}
                      onChange={(event) => setScheduleCode(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Schedule name</Label>
                    <Input
                      value={scheduleName}
                      onChange={(event) => setScheduleName(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Recurrence rule</Label>
                    <Input
                      value={recurrenceRule}
                      onChange={(event) => setRecurrenceRule(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Rate plan code</Label>
                    <Input
                      value={ratePlanCode}
                      onChange={(event) => setRatePlanCode(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label>Rate plan name</Label>
                    <Input
                      value={ratePlanName}
                      onChange={(event) => setRatePlanName(event.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <Label>Pricing categories</Label>
                  <Button type="button" size="sm" variant="outline" onClick={addCategory}>
                    <Plus className="mr-2 size-4" aria-hidden="true" />
                    Add category
                  </Button>
                </div>

                <div className="grid gap-2">
                  {categories.map((category) => (
                    <div
                      key={category.localId}
                      className="grid gap-2 rounded-md border p-2 md:grid-cols-[minmax(7rem,0.8fr)_minmax(10rem,1.5fr)_minmax(8rem,1fr)_minmax(6rem,0.7fr)_auto]"
                    >
                      <Input
                        aria-label="Category code"
                        value={category.code}
                        onChange={(event) =>
                          updateCategory(category.localId, {
                            code: normalizeCode(event.target.value, category.code),
                          })
                        }
                      />
                      <Input
                        aria-label="Category name"
                        value={category.name}
                        onChange={(event) =>
                          updateCategory(category.localId, { name: event.target.value })
                        }
                      />
                      <select
                        aria-label="Category type"
                        className="h-9 rounded-md border bg-background px-2 text-sm"
                        value={category.categoryType}
                        onChange={(event) =>
                          updateCategory(category.localId, {
                            categoryType: event.target.value as CategoryType,
                          })
                        }
                      >
                        {categoryTypes.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                      <Input
                        aria-label="Seat occupancy"
                        type="number"
                        min={0}
                        value={category.seatOccupancy}
                        onChange={(event) =>
                          updateCategory(category.localId, {
                            seatOccupancy: Number.parseInt(event.target.value, 10) || 0,
                          })
                        }
                      />
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => removeCategory(category.localId)}
                        disabled={categories.length === 1}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                        <span className="sr-only">Remove category</span>
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label>Price matrix</Label>
                    <span className="text-xs text-muted-foreground">
                      {priceCatalog?.currencyCode ?? "minor currency units are generated"} prices
                    </span>
                  </div>
                  <div className="overflow-auto rounded-md border">
                    <table className="min-w-full border-collapse text-sm">
                      <thead className="bg-muted/40">
                        <tr>
                          <th className="min-w-48 border-b px-3 py-2 text-left font-medium">
                            Unit
                          </th>
                          {categories.map((category) => (
                            <th
                              key={category.localId}
                              className="min-w-32 border-b px-3 py-2 text-left font-medium"
                            >
                              {category.code}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {units.map((unit) => (
                          <tr key={unit.id}>
                            <td className="border-b px-3 py-2">
                              <div className="font-medium">{unit.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {unit.code ?? unit.unitType}
                              </div>
                            </td>
                            {categories.map((category) => (
                              <td key={category.localId} className="border-b px-3 py-2">
                                <Input
                                  aria-label={`${unit.name} ${category.code} price`}
                                  inputMode="decimal"
                                  value={cellDrafts[cellKey(unit.id, category.code)] ?? ""}
                                  onChange={(event) =>
                                    updateCell(unit.id, category.code, event.target.value)
                                  }
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                        {units.length === 0 ? (
                          <tr>
                            <td
                              className="px-3 py-6 text-center text-muted-foreground"
                              colSpan={categories.length + 1}
                            >
                              Add option units before importing unit prices.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Paste matrix</Label>
                  <Textarea
                    className="min-h-24 font-mono text-xs"
                    value={pasteValue}
                    onChange={(event) => setPasteValue(event.target.value)}
                    placeholder={"Unit\tDBL\tSGL\nDouble room\t1299\t1499"}
                    spellCheck={false}
                  />
                  <div>
                    <Button type="button" size="sm" variant="outline" onClick={applyPastedMatrix}>
                      <Upload className="mr-2 size-4" aria-hidden="true" />
                      Apply pasted matrix
                    </Button>
                  </div>
                </div>

                <details className="rounded-md border p-3">
                  <summary className="cursor-pointer text-sm font-medium">Generated JSON</summary>
                  <Textarea
                    className="mt-3 min-h-64 font-mono text-xs"
                    value={generatedPayload}
                    readOnly
                    spellCheck={false}
                  />
                </details>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>JSON payload</Label>
                <Textarea
                  className="min-h-96 font-mono text-xs"
                  value={payload}
                  onChange={(event) => setPayload(event.target.value)}
                  spellCheck={false}
                />
              </div>
            )}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {result ? <MatrixImportSummary result={result} /> : null}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button type="button" disabled={saving || !priceCatalog} onClick={submit}>
                {saving ? (
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                ) : null}
                {buttonLabel}
              </Button>
            </div>
          </div>
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}

function MatrixImportSummary({ result }: { result: RatePlanMatrixImportResponse }) {
  const rows = [
    ["Schedules", result.summary.schedules],
    ["Categories", result.summary.pricingCategories],
    ["Rate plans", result.summary.ratePlans],
    ["Unit prices", result.summary.unitPrices],
    ["Overrides", result.summary.departureOverrides],
  ] as const

  return (
    <div className="rounded-md border p-3 text-sm">
      <p className="mb-2 font-medium">{result.summary.dryRun ? "Validated" : "Imported"}</p>
      <div className="grid gap-1">
        {rows.map(([label, summary]) => (
          <div key={label} className="flex justify-between gap-3 text-muted-foreground">
            <span>{label}</span>
            <span>
              {summary.requested} requested, {summary.created} create, {summary.updated} update
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
