"use client"

import type { ReportQuery, ReportWidgetDefinition } from "@voyant-travel/reporting-contracts"
import { Button } from "@voyant-travel/ui/components"
import { useCallback, useState } from "react"

import { parseQuerySource, previewQuery } from "./api.js"
import { type ReportingClient, VoyantApiError } from "./client.js"
import { QueryCodeEditor } from "./query-code-editor.js"
import { ReportVisualizationView } from "./renderers/report-renderer.js"
import type { ReportingCatalog } from "./report-document.js"

const VISUALIZATION_TYPES = ["kpi", "table", "line", "bar", "pie"] as const
type VisualizationType = (typeof VISUALIZATION_TYPES)[number]

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"

export interface CustomWidgetEditorProps {
  readonly client: ReportingClient
  readonly catalog: ReportingCatalog
  /** When editing an existing custom widget, its current definition. */
  readonly initialDefinition?: ReportWidgetDefinition
  /** Called with the new/updated custom widget definition. */
  readonly onCommit: (definition: ReportWidgetDefinition) => void
  readonly onCancel?: () => void
  /** Factory for the generated widget definition id (injectable for tests). */
  readonly createDefinitionId?: () => string
}

function defaultDefinitionId(): string {
  const suffix = Math.random().toString(36).slice(2, 10)
  return `custom-${suffix}`
}

/**
 * First-class, bounded query editor for custom widgets. The author writes the
 * intentionally small SQL-like language; the server compiles it via
 * `/queries/parse` and executes previews via `/queries/preview`. No raw SQL or
 * JavaScript is ever accepted or executed here.
 */
export function CustomWidgetEditor({
  client,
  catalog,
  initialDefinition,
  onCommit,
  onCancel,
  createDefinitionId = defaultDefinitionId,
}: CustomWidgetEditorProps) {
  const [label, setLabel] = useState(initialDefinition?.label ?? "")
  const [type, setType] = useState<VisualizationType>(
    (initialDefinition?.visualization.type as VisualizationType | undefined) ?? "table",
  )
  const [source, setSource] = useState("")
  const [parsedQuery, setParsedQuery] = useState<ReportQuery | null>(
    initialDefinition?.query ?? null,
  )
  const [parseError, setParseError] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)

  const [preview, setPreview] = useState<ReturnType<typeof buildPreviewDefinition> | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewData, setPreviewData] = useState<Awaited<ReturnType<typeof previewQuery>> | null>(
    null,
  )
  const [previewing, setPreviewing] = useState(false)

  const runParse = useCallback(async () => {
    setParsing(true)
    setParseError(null)
    try {
      const query = await parseQuerySource(client, source)
      setParsedQuery(query)
    } catch (error) {
      setParsedQuery(null)
      setParseError(errorMessage(error))
    } finally {
      setParsing(false)
    }
  }, [client, source])

  const runPreview = useCallback(async () => {
    if (!parsedQuery) return
    setPreviewing(true)
    setPreviewError(null)
    const definition = buildPreviewDefinition(parsedQuery, type, label)
    setPreview(definition)
    try {
      const result = await previewQuery(client, { query: parsedQuery })
      setPreviewData(result)
    } catch (error) {
      setPreviewData(null)
      setPreviewError(errorMessage(error))
    } finally {
      setPreviewing(false)
    }
  }, [client, parsedQuery, type, label])

  const commit = useCallback(() => {
    if (!parsedQuery || label.trim().length === 0) return
    const definition: ReportWidgetDefinition = {
      id: initialDefinition?.id ?? createDefinitionId(),
      version: initialDefinition?.version ?? 1,
      label: label.trim(),
      query: parsedQuery,
      visualization: { type, options: initialDefinition?.visualization.options ?? {} },
      defaultSize: initialDefinition?.defaultSize ?? { width: 6, height: 4 },
      ...(initialDefinition?.minimumSize ? { minimumSize: initialDefinition.minimumSize } : {}),
      ...(initialDefinition?.maximumSize ? { maximumSize: initialDefinition.maximumSize } : {}),
    }
    onCommit(definition)
  }, [parsedQuery, label, type, initialDefinition, createDefinitionId, onCommit])

  const canCommit = parsedQuery !== null && label.trim().length > 0

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Title</span>
        <input
          className={inputClass}
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Widget title"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Visualization</span>
        <select
          className={inputClass}
          value={type}
          onChange={(event) => setType(event.target.value as VisualizationType)}
        >
          {VISUALIZATION_TYPES.map((value) => (
            <option key={value} value={value}>
              {value.toUpperCase()}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Query</span>
        <QueryCodeEditor value={source} onChange={setSource} ariaLabel="Widget query" />
      </div>

      <DatasetHints catalog={catalog} />

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={runParse} disabled={parsing}>
          {parsing ? "Parsing…" : "Parse"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={runPreview}
          disabled={!parsedQuery || previewing}
        >
          {previewing ? "Previewing…" : "Preview"}
        </Button>
        <Button type="button" size="sm" onClick={commit} disabled={!canCommit}>
          {initialDefinition ? "Apply" : "Add to report"}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>

      {parseError ? (
        <p className="text-destructive text-sm" role="alert">
          {parseError}
        </p>
      ) : null}
      {parsedQuery && !parseError ? (
        <p className="text-muted-foreground text-sm">
          Parsed query against dataset <code>{parsedQuery.dataset.id}</code>.
        </p>
      ) : null}

      {previewError ? (
        <p className="text-destructive text-sm" role="alert">
          {previewError}
        </p>
      ) : null}
      {preview && previewData && !previewError ? (
        <div className="rounded-md border p-3">
          <ReportVisualizationView definition={preview} result={previewData} />
        </div>
      ) : null}
    </div>
  )
}

/** A compact reference of available datasets and their fields to author against. */
function DatasetHints({ catalog }: { catalog: ReportingCatalog }) {
  if (catalog.datasets.length === 0) return null
  return (
    <details className="rounded-md border p-2 text-sm">
      <summary className="cursor-pointer font-medium">Available datasets</summary>
      <ul className="mt-2 flex flex-col gap-2">
        {catalog.datasets.map((dataset) => (
          <li key={`${dataset.id}@${dataset.version}`}>
            <code>{dataset.id}</code> — {dataset.label}
            <div className="text-muted-foreground mt-1 text-xs">
              {dataset.fields.map((field) => field.id).join(", ")}
            </div>
          </li>
        ))}
      </ul>
    </details>
  )
}

function buildPreviewDefinition(
  query: ReportQuery,
  type: VisualizationType,
  label: string,
): ReportWidgetDefinition {
  return {
    id: "preview",
    version: 1,
    label: label.trim().length > 0 ? label.trim() : "Preview",
    query,
    visualization: { type, options: {} },
    defaultSize: { width: 6, height: 4 },
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof VoyantApiError) return error.message
  if (error instanceof Error) return error.message
  return "Something went wrong."
}
