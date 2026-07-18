"use client"

import { useQueryClient } from "@tanstack/react-query"
import type { ReportWidgetDefinition } from "@voyant-travel/reporting-contracts"
import { Button } from "@voyant-travel/ui/components"
import { useCallback, useMemo, useState } from "react"
import { resolveLabels } from "../components/labels.js"
import { ReportCanvas } from "../components/report-canvas.js"
import { useNarrowViewport } from "../hooks/use-narrow-viewport.js"
import { useReducedMotion } from "../hooks/use-reduced-motion.js"
import { moveItem, normalizeLayout, resizeItem } from "../layout/grid-model.js"
import { buildRegistry, constraintsFromRegistry, renderableItems } from "../report-model.js"
import { CANONICAL_COLUMNS, type LayoutItem, type WidgetDefinition } from "../types.js"
import { getReportQueryOptions, type ReportDefinitionRow, updateReport } from "./api.js"
import type { ReportingClient } from "./client.js"
import { CustomWidgetEditor } from "./query-editor.js"
import { ReportWidgetView } from "./renderers/report-widget-view.js"
import {
  addCustomInstance,
  addPresetInstance,
  applyItemsToDraft,
  instanceTitle,
  type ReportingCatalog,
  removeInstance,
  resolveDraft,
  setCustomInstanceDefinition,
  setInstanceTitle,
} from "./report-document.js"
import { type ReportDocumentController, useReportDocument } from "./use-report-document.js"

export interface ReportBuilderAdminProps {
  readonly client: ReportingClient
  readonly catalog: ReportingCatalog
  readonly report: ReportDefinitionRow
  readonly initialMode?: "view" | "edit"
  readonly columns?: number
  readonly rowHeight?: number
  readonly autosaveDelayMs?: number
  readonly narrowBreakpointPx?: number
}

/**
 * The cohesive admin report builder: an explicit view/edit toggle over an
 * instance-aware {@link ReportDraft}. Layout edits, added/removed instances,
 * titles, and custom query definitions all flow through the document controller
 * and are autosaved with revision-guarded PATCHes.
 */
export function ReportBuilderAdmin({
  client,
  catalog,
  report,
  initialMode = "view",
  columns = CANONICAL_COLUMNS,
  rowHeight = 64,
  autosaveDelayMs,
  narrowBreakpointPx = 640,
}: ReportBuilderAdminProps) {
  const labels = useMemo(() => resolveLabels(), [])
  const queryClient = useQueryClient()

  const adapter = useMemo(
    () => ({
      save: (input: Parameters<typeof updateReport>[2]) => updateReport(client, report.id, input),
      reload: () => queryClient.fetchQuery(getReportQueryOptions(client, report.id)),
    }),
    [client, report.id, queryClient],
  )

  const doc = useReportDocument(
    {
      draft: report.draft,
      name: report.name,
      description: report.description,
      revision: report.revision,
    },
    adapter,
    { autosaveDelayMs },
  )

  const [mode, setMode] = useState<"view" | "edit">(initialMode)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [addingCustom, setAddingCustom] = useState(false)

  const narrow = useNarrowViewport(narrowBreakpointPx)
  const animate = !useReducedMotion()
  const editable = mode === "edit"

  const resolved = useMemo(() => resolveDraft(doc.draft, catalog), [doc.draft, catalog])
  const parameters = doc.draft.parameters

  // One grid `WidgetDefinition` per AVAILABLE instance, keyed by the *instance*
  // id (not the preset id) so multiple instances of one preset coexist.
  const widgets = useMemo<WidgetDefinition[]>(
    () =>
      resolved
        .filter((entry) => entry.available && entry.definition)
        .map((entry): WidgetDefinition => {
          const definition = entry.definition as ReportWidgetDefinition
          return {
            id: entry.instance.id,
            title: instanceTitle(entry.instance, definition),
            description: definition.description,
            defaultSize: definition.defaultSize,
            minSize: definition.minimumSize,
            maxSize: definition.maximumSize,
            render: () => (
              <ReportWidgetView definition={definition} client={client} parameters={parameters} />
            ),
            // Presence enables the configure affordance; the actual inspector is
            // rendered by this component, keyed by the selected instance.
            renderConfig: () => null,
          }
        }),
    [resolved, client, parameters],
  )

  const registry = useMemo(() => buildRegistry(widgets), [widgets])
  const constraints = useMemo(() => constraintsFromRegistry(registry), [registry])

  const items = useMemo(() => resolved.map((entry) => entry.item), [resolved])
  const visibleItems = useMemo(
    () => renderableItems(items, registry, mode),
    [items, registry, mode],
  )

  const handleLayoutChange = useCallback(
    (nextItems: LayoutItem[]) => {
      const normalized = normalizeLayout(nextItems, columns, constraints)
      doc.updateDraft((draft) => applyItemsToDraft(draft, normalized))
    },
    [doc, columns, constraints],
  )

  const handleMove = useCallback(
    (widgetId: string, delta: { dx: number; dy: number }) => {
      const next = moveItem(items, widgetId, delta, columns, constraints[widgetId])
      doc.updateDraft((draft) => applyItemsToDraft(draft, next))
    },
    [doc, items, columns, constraints],
  )

  const handleResize = useCallback(
    (widgetId: string, delta: { dWidth: number; dHeight: number }) => {
      const next = resizeItem(items, widgetId, delta, columns, constraints[widgetId])
      doc.updateDraft((draft) => applyItemsToDraft(draft, next))
    },
    [doc, items, columns, constraints],
  )

  const handleRemove = useCallback(
    (widgetId: string) => {
      doc.updateDraft((draft) => removeInstance(draft, widgetId))
      setSelectedId((current) => (current === widgetId ? null : current))
    },
    [doc],
  )

  const handleAddPreset = useCallback(
    (widget: ReportWidgetDefinition) => {
      let newId = ""
      doc.updateDraft((draft) => {
        const result = addPresetInstance(draft, widget, { columns })
        newId = result.instanceId
        return result.draft
      })
      setSelectedId(newId)
    },
    [doc, columns],
  )

  const handleAddCustom = useCallback(
    (definition: ReportWidgetDefinition) => {
      let newId = ""
      doc.updateDraft((draft) => {
        const result = addCustomInstance(draft, definition, { columns })
        newId = result.instanceId
        return result.draft
      })
      setSelectedId(newId)
      setAddingCustom(false)
    },
    [doc, columns],
  )

  const selectedEntry = selectedId
    ? (resolved.find((entry) => entry.instance.id === selectedId) ?? null)
    : null

  const canvas = (
    <ReportCanvas
      items={visibleItems}
      registry={registry}
      mode={mode}
      labels={labels}
      columns={columns}
      rowHeight={rowHeight}
      narrow={narrow}
      animate={animate}
      selectedId={selectedId}
      onLayoutChange={editable ? handleLayoutChange : undefined}
      onMove={handleMove}
      onResize={handleResize}
      onRemove={handleRemove}
      onConfigure={setSelectedId}
    />
  )

  return (
    <div className="flex flex-col gap-4" data-mode={mode}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{doc.name}</h1>
          {doc.description ? (
            <p className="text-muted-foreground text-sm">{doc.description}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <SaveStatus doc={doc} />
          {/* biome-ignore lint/a11y/useSemanticElements: intentional — a two-button view/edit toggle is an ARIA group, not a form fieldset (owner: reporting) */}
          <div
            className="inline-flex rounded-md border p-0.5"
            role="group"
            aria-label="Report mode"
          >
            <Button
              type="button"
              size="sm"
              variant={mode === "view" ? "default" : "ghost"}
              aria-pressed={mode === "view"}
              onClick={() => setMode("view")}
            >
              View
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "edit" ? "default" : "ghost"}
              aria-pressed={mode === "edit"}
              onClick={() => setMode("edit")}
            >
              Edit
            </Button>
          </div>
        </div>
      </header>

      {doc.status === "conflict" ? (
        <div
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
          role="alert"
        >
          <span>This report changed elsewhere since you opened it.</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => void doc.resolveConflict("reload")}>
              Reload theirs
            </Button>
            <Button size="sm" onClick={() => void doc.resolveConflict("overwrite")}>
              Keep mine
            </Button>
          </div>
        </div>
      ) : null}

      {editable ? (
        <div className="grid gap-4 lg:grid-cols-[16rem_1fr_20rem]">
          <aside className="flex flex-col gap-2">
            <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
              Widgets
            </h2>
            {catalog.widgets.length === 0 ? (
              <p className="text-muted-foreground text-sm">No preset widgets available.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {catalog.widgets.map((widget) => (
                  <li key={`${widget.id}@${widget.version}`}>
                    <button
                      type="button"
                      className="w-full rounded-md border px-2 py-1.5 text-left text-sm hover:border-primary"
                      onClick={() => handleAddPreset(widget)}
                    >
                      <span className="font-medium">{widget.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAddingCustom((value) => !value)}
            >
              {addingCustom ? "Close custom widget" : "Add custom widget"}
            </Button>
            {addingCustom ? (
              <div className="rounded-md border p-2">
                <CustomWidgetEditor
                  client={client}
                  catalog={catalog}
                  onCommit={handleAddCustom}
                  onCancel={() => setAddingCustom(false)}
                />
              </div>
            ) : null}
          </aside>

          <div className="min-w-0">{canvas}</div>

          <aside className="flex flex-col gap-2">
            <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
              Configure
            </h2>
            {selectedEntry ? (
              <InstanceInspector
                key={selectedEntry.instance.id}
                client={client}
                catalog={catalog}
                doc={doc}
                instanceId={selectedEntry.instance.id}
                definition={selectedEntry.definition}
                isCustom={selectedEntry.instance.source.kind === "custom"}
                titleValue={selectedEntry.instance.title ?? ""}
                onRemove={() => handleRemove(selectedEntry.instance.id)}
              />
            ) : (
              <p className="text-muted-foreground text-sm">Select a widget to configure it.</p>
            )}
          </aside>
        </div>
      ) : (
        canvas
      )}
    </div>
  )
}

function SaveStatus({ doc }: { doc: ReportDocumentController }) {
  const text =
    doc.status === "saving"
      ? "Saving…"
      : doc.status === "saved"
        ? "All changes saved"
        : doc.status === "error"
          ? "Could not save"
          : doc.status === "conflict"
            ? "Save conflict"
            : doc.isDirty
              ? "Unsaved changes"
              : "All changes saved"
  return (
    <span className="text-muted-foreground text-sm" role="status" aria-live="polite">
      {text}
      {doc.status === "error" ? (
        <button type="button" className="ml-2 underline" onClick={() => void doc.flush()}>
          Retry
        </button>
      ) : null}
    </span>
  )
}

function InstanceInspector({
  client,
  catalog,
  doc,
  instanceId,
  definition,
  isCustom,
  titleValue,
  onRemove,
}: {
  client: ReportingClient
  catalog: ReportingCatalog
  doc: ReportDocumentController
  instanceId: string
  definition: ReportWidgetDefinition | undefined
  isCustom: boolean
  titleValue: string
  onRemove: () => void
}) {
  const [title, setTitle] = useState(titleValue)
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Title</span>
        <input
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value)
            doc.updateDraft((draft) => setInstanceTitle(draft, instanceId, event.target.value))
          }}
          placeholder={definition?.label ?? "Widget title"}
        />
      </label>

      {isCustom && definition ? (
        <div>
          <h3 className="mb-1 text-sm font-medium">Query</h3>
          <CustomWidgetEditor
            client={client}
            catalog={catalog}
            initialDefinition={definition}
            onCommit={(next) =>
              doc.updateDraft((draft) => setCustomInstanceDefinition(draft, instanceId, next))
            }
          />
        </div>
      ) : null}

      <Button type="button" variant="destructive" size="sm" onClick={onRemove}>
        Remove widget
      </Button>
    </div>
  )
}
