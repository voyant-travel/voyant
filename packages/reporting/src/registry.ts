import {
  type ReportDatasetContribution,
  type ReportDraft,
  type ReportingContributionRuntime,
  type ReportParameters,
  type ReportQuery,
  type ReportTemplateDefinition,
  type ReportWidgetDefinition,
  reportDatasetDefinitionSchema,
  reportQuerySchema,
  reportResultSchema,
  reportTemplateDefinitionSchema,
  reportWidgetDefinitionSchema,
} from "@voyant-travel/reporting-contracts"

export type ReportBuilderMode = "view" | "edit"

export interface ResolvedReportWidget {
  instance: ReportDraft["widgets"][number]
  status: "available" | "missing"
  definition?: ReportWidgetDefinition
  missingReason?: string
}

export interface ReportingCatalog {
  datasets: ReturnType<ReportingRegistry["listDatasets"]>
  widgets: readonly ReportWidgetDefinition[]
  templates: readonly ReportTemplateDefinition[]
}

export class ReportingRegistryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ReportingRegistryError"
  }
}

export class ReportingAuthorizationError extends ReportingRegistryError {
  readonly missingScopes: readonly string[]

  constructor(missingScopes: readonly string[]) {
    super(`Missing required dataset scopes: ${missingScopes.join(", ")}.`)
    this.name = "ReportingAuthorizationError"
    this.missingScopes = missingScopes
  }
}

/** Immutable registry assembled from graph-selected module contributions. */
export class ReportingRegistry {
  readonly #datasets = new Map<string, ReportDatasetContribution>()
  readonly #widgets = new Map<string, ReportWidgetDefinition>()
  readonly #templates = new Map<string, ReportTemplateDefinition>()

  constructor(contributions: readonly ReportingContributionRuntime[]) {
    for (const contribution of contributions) this.#addContribution(contribution)
  }

  listDatasets() {
    return [...this.#datasets.values()]
      .map(({ definition }) => definition)
      .sort(compareVersionedDefinitions)
  }

  listWidgets(): readonly ReportWidgetDefinition[] {
    return [...this.#widgets.values()].sort(compareVersionedDefinitions)
  }

  listTemplates(): readonly ReportTemplateDefinition[] {
    return [...this.#templates.values()].sort(compareVersionedDefinitions)
  }

  catalog(): ReportingCatalog {
    return {
      datasets: this.listDatasets(),
      widgets: this.listWidgets(),
      templates: this.listTemplates(),
    }
  }

  getTemplate(id: string, version?: number): ReportTemplateDefinition | undefined {
    return this.#resolveVersion(this.#templates, id, version)
  }

  getWidget(id: string, version?: number): ReportWidgetDefinition | undefined {
    return this.#resolveVersion(this.#widgets, id, version)
  }

  getDataset(id: string, version?: number): ReportDatasetContribution | undefined {
    return this.#resolveVersion(this.#datasets, id, version)
  }

  resolveDraft(draft: ReportDraft, mode: ReportBuilderMode): ResolvedReportWidget[] {
    const resolved = draft.widgets.map((instance): ResolvedReportWidget => {
      const definition =
        instance.source.kind === "custom"
          ? instance.source.definition
          : this.getWidget(instance.source.widgetId, instance.source.version)
      if (!definition) {
        return {
          instance,
          status: "missing",
          missingReason: `Widget preset ${JSON.stringify(instance.source.kind === "preset" ? instance.source.widgetId : instance.id)} is unavailable.`,
        }
      }
      const dataset = this.getDataset(definition.query.dataset.id, definition.query.dataset.version)
      if (!dataset) {
        return {
          instance,
          status: "missing",
          definition,
          missingReason: `Dataset ${JSON.stringify(definition.query.dataset.id)} is unavailable.`,
        }
      }
      return { instance, status: "available", definition }
    })
    return mode === "view" ? resolved.filter((widget) => widget.status === "available") : resolved
  }

  /** Materialize preset references so a published version remains reproducible. */
  snapshotDraft(draft: ReportDraft): ReportDraft {
    return {
      parameters: { ...draft.parameters },
      widgets: draft.widgets.map((instance) => {
        const definition =
          instance.source.kind === "custom"
            ? instance.source.definition
            : this.getWidget(instance.source.widgetId, instance.source.version)
        if (!definition) {
          throw new ReportingRegistryError(
            `Widget preset ${JSON.stringify(instance.source.kind === "preset" ? instance.source.widgetId : instance.id)} is unavailable and cannot be published.`,
          )
        }
        const dataset = this.getDataset(definition.query.dataset.id, definition.query.dataset.version)
        if (!dataset) {
          throw new ReportingRegistryError(
            `Dataset ${JSON.stringify(definition.query.dataset.id)} is unavailable and cannot be published.`,
          )
        }
        const snapshot = {
          ...definition,
          query: {
            ...definition.query,
            dataset: { id: dataset.definition.id, version: dataset.definition.version },
          },
        }
        return { ...instance, source: { kind: "custom" as const, definition: snapshot } }
      }),
    }
  }

  validateQuery(
    queryInput: ReportQuery,
    grantedScopes: readonly string[],
  ): {
    query: ReportQuery
    dataset: ReportDatasetContribution
    maximumRows: number
    requiredScopes: readonly string[]
  } {
    const query = reportQuerySchema.parse(queryInput)
    const dataset = this.getDataset(query.dataset.id, query.dataset.version)
    if (!dataset)
      throw new ReportingRegistryError(
        `Dataset ${JSON.stringify(query.dataset.id)} is unavailable.`,
      )

    const fields = new Map(dataset.definition.fields.map((field) => [field.id, field]))
    const usedFields = new Set<string>()
    const fieldSelections: string[] = []
    const hasAggregate = query.select.some((selection) => selection.kind === "aggregate")
    for (const selection of query.select) {
      if (selection.kind === "field") {
        usedFields.add(selection.field)
        fieldSelections.push(selection.field)
      } else if (selection.field) {
        usedFields.add(selection.field)
        const field = fields.get(selection.field)
        if (field && !field.aggregations.includes(selection.operation)) {
          throw new ReportingRegistryError(
            `Field ${JSON.stringify(selection.field)} does not support ${selection.operation}.`,
          )
        }
      } else if (selection.operation !== "count") {
        throw new ReportingRegistryError(`${selection.operation} requires a field.`)
      }
    }
    for (const filter of query.filters) usedFields.add(filter.field)
    for (const group of query.groupBy) usedFields.add(group.field)
    if (hasAggregate || query.groupBy.length > 0) {
      const groupedFields = new Set(query.groupBy.map((group) => group.field))
      const ungrouped = fieldSelections.filter((field) => !groupedFields.has(field))
      if (ungrouped.length > 0) {
        throw new ReportingRegistryError(
          `Selected fields must be grouped when a query groups or aggregates: ${ungrouped.join(", ")}.`,
        )
      }
    }
    const requiredScopes = new Set(dataset.definition.requiredScopes)
    for (const fieldId of usedFields) {
      const field = fields.get(fieldId)
      if (!field)
        throw new ReportingRegistryError(`Field ${JSON.stringify(fieldId)} is unavailable.`)
      for (const scope of field.requiredScopes) requiredScopes.add(scope)
    }
    for (const filter of query.filters) {
      if (filter.operator === "isNull" || filter.operator === "isNotNull") {
        if (filter.value !== undefined) {
          throw new ReportingRegistryError(`${filter.operator} does not accept a value.`)
        }
      } else if (filter.value === undefined) {
        throw new ReportingRegistryError(`${filter.operator} requires a value.`)
      }
    }
    const maximumRows = Math.min(
      query.limit ?? dataset.definition.defaultLimit,
      dataset.definition.maximumLimit,
    )
    const requiredScopeList = [...requiredScopes].sort()
    requireReportingScopes(requiredScopeList, grantedScopes)
    return { query, dataset, maximumRows, requiredScopes: requiredScopeList }
  }

  async executeQuery(input: {
    db: unknown
    actorId?: string
    grantedScopes: readonly string[]
    query: ReportQuery
    parameters?: ReportParameters
    signal?: AbortSignal
  }) {
    const { query, dataset, maximumRows } = this.validateQuery(input.query, input.grantedScopes)
    for (const filter of query.filters) {
      if (filter.value?.kind === "parameter" && !(filter.value.name in (input.parameters ?? {}))) {
        throw new ReportingRegistryError(
          `Missing query parameter ${JSON.stringify(filter.value.name)}.`,
        )
      }
    }
    const result = reportResultSchema.parse(
      await dataset.execute(
        {
          db: input.db,
          actorId: input.actorId,
          grantedScopes: input.grantedScopes,
          signal: input.signal,
        },
        { query, parameters: input.parameters ?? {}, maximumRows },
      ),
    )
    if (result.rows.length <= maximumRows) return result
    return { ...result, rows: result.rows.slice(0, maximumRows), truncated: true }
  }

  #addContribution(contribution: ReportingContributionRuntime): void {
    if (!contribution.namespace.trim())
      throw new ReportingRegistryError("Contribution namespace is required.")
    for (const candidate of contribution.datasets ?? []) {
      const definition = reportDatasetDefinitionSchema.parse(candidate.definition)
      this.#addVersioned(this.#datasets, definition, { ...candidate, definition }, "dataset")
    }
    for (const candidate of contribution.widgets ?? []) {
      const definition = reportWidgetDefinitionSchema.parse(candidate)
      this.#addVersioned(this.#widgets, definition, definition, "widget")
    }
    for (const candidate of contribution.templates ?? []) {
      const definition = reportTemplateDefinitionSchema.parse(candidate)
      this.#addVersioned(this.#templates, definition, definition, "template")
    }
  }

  #addVersioned<T>(
    registry: Map<string, T>,
    definition: { id: string; version: number },
    value: T,
    kind: string,
  ): void {
    const key = versionedKey(definition.id, definition.version)
    if (registry.has(key)) {
      throw new ReportingRegistryError(
        `Duplicate ${kind} ${JSON.stringify(definition.id)} version ${definition.version}.`,
      )
    }
    registry.set(key, Object.freeze(value))
  }

  #resolveVersion<T>(registry: Map<string, T>, id: string, version?: number): T | undefined {
    if (version !== undefined) return registry.get(versionedKey(id, version))
    const versions = [...registry.entries()]
      .filter(([key]) => key.startsWith(`${id}@`))
      .map(([key, value]) => ({ version: Number(key.slice(key.lastIndexOf("@") + 1)), value }))
      .sort((left, right) => right.version - left.version)
    return versions[0]?.value
  }
}

export function requireReportingScopes(
  required: readonly string[],
  granted: readonly string[],
): void {
  const missing = required.filter((scope) => !hasScope(granted, scope))
  if (missing.length > 0) {
    throw new ReportingAuthorizationError(missing)
  }
}

export function hasReportingScope(granted: readonly string[], required: string): boolean {
  const [resource] = required.split(":")
  return granted.some(
    (scope) => scope === required || scope === "*" || scope === "*:*" || scope === `${resource}:*`,
  )
}

const hasScope = hasReportingScope

function versionedKey(id: string, version: number): string {
  return `${id}@${version}`
}

function compareVersionedDefinitions(
  left: { id: string; version: number },
  right: { id: string; version: number },
): number {
  return left.id.localeCompare(right.id) || left.version - right.version
}
