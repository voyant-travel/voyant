import type {
  createReportDefinitionSchema,
  ReportDraft,
  ReportParameters,
  updateReportDefinitionSchema,
} from "@voyant-travel/reporting-contracts"
import { and, desc, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { z } from "zod"

import type { ReportingRegistry } from "./registry.js"
import {
  type ReportDefinitionRow,
  type ReportRunOutput,
  reportDefinitions,
  reportRuns,
  reportVersions,
} from "./schema.js"

export type CreateReportDefinitionInput = z.infer<typeof createReportDefinitionSchema>
export type UpdateReportDefinitionInput = z.infer<typeof updateReportDefinitionSchema>

export class ReportDefinitionRevisionConflictError extends Error {
  constructor() {
    super("The report draft changed since it was loaded.")
    this.name = "ReportDefinitionRevisionConflictError"
  }
}

export class ReportingRecordNotFoundError extends Error {
  constructor(record: string) {
    super(`${record} was not found.`)
    this.name = "ReportingRecordNotFoundError"
  }
}

export class ReportDefinitionRetentionConflictError extends Error {
  constructor() {
    super("Reports with retained execution history cannot be deleted.")
    this.name = "ReportDefinitionRetentionConflictError"
  }
}

export function createReportingService(registry: ReportingRegistry) {
  return {
    async list(db: PostgresJsDatabase, input: { limit: number; offset: number }) {
      const [data, count] = await Promise.all([
        db
          .select()
          .from(reportDefinitions)
          .orderBy(desc(reportDefinitions.updatedAt))
          .limit(input.limit)
          .offset(input.offset),
        db.select({ count: sql<number>`count(*)::int` }).from(reportDefinitions),
      ])
      return { data, total: count[0]?.count ?? 0, ...input }
    },

    async get(db: PostgresJsDatabase, id: string): Promise<ReportDefinitionRow | null> {
      const [row] = await db
        .select()
        .from(reportDefinitions)
        .where(eq(reportDefinitions.id, id))
        .limit(1)
      return row ?? null
    },

    async create(db: PostgresJsDatabase, input: CreateReportDefinitionInput, actorId?: string) {
      const [row] = await db
        .insert(reportDefinitions)
        .values({
          ...input,
          description: input.description ?? null,
          sourceTemplateId: input.sourceTemplateId ?? null,
          sourceTemplateVersion: input.sourceTemplateVersion ?? null,
          createdByUserId: actorId,
          updatedByUserId: actorId,
        })
        .returning()
      if (!row) throw new Error("Report definition insert returned no row.")
      return row
    },

    async instantiateTemplate(
      db: PostgresJsDatabase,
      input: { templateId: string; version?: number; name: string; description?: string | null },
      actorId?: string,
    ) {
      const template = registry.getTemplate(input.templateId, input.version)
      if (!template) throw new ReportingRecordNotFoundError("Report template")
      return this.create(
        db,
        {
          name: input.name,
          description: input.description,
          sourceTemplateId: template.id,
          sourceTemplateVersion: template.version,
          draft: { parameters: {}, widgets: template.widgets },
        },
        actorId,
      )
    },

    async update(
      db: PostgresJsDatabase,
      id: string,
      input: UpdateReportDefinitionInput,
      actorId?: string,
    ) {
      const { revision, ...patch } = input
      const [row] = await db
        .update(reportDefinitions)
        .set({ ...patch, revision: revision + 1, updatedByUserId: actorId, updatedAt: new Date() })
        .where(and(eq(reportDefinitions.id, id), eq(reportDefinitions.revision, revision)))
        .returning()
      if (row) return row
      const existing = await this.get(db, id)
      if (!existing) throw new ReportingRecordNotFoundError("Report definition")
      throw new ReportDefinitionRevisionConflictError()
    },

    async remove(db: PostgresJsDatabase, id: string): Promise<boolean> {
      return db.transaction(async (transaction) => {
        const [definition] = await transaction
          .select({ id: reportDefinitions.id })
          .from(reportDefinitions)
          .where(eq(reportDefinitions.id, id))
          .limit(1)
          .for("update")
        if (!definition) return false
        await transaction
          .select({ id: reportVersions.id })
          .from(reportVersions)
          .where(eq(reportVersions.reportDefinitionId, id))
          .for("update")
        const [retainedRun] = await transaction
          .select({ id: reportRuns.id })
          .from(reportRuns)
          .innerJoin(reportVersions, eq(reportRuns.reportVersionId, reportVersions.id))
          .where(eq(reportVersions.reportDefinitionId, id))
          .limit(1)
        if (retainedRun) throw new ReportDefinitionRetentionConflictError()
        await transaction.delete(reportDefinitions).where(eq(reportDefinitions.id, id))
        return true
      })
    },

    async createVersion(
      db: PostgresJsDatabase,
      reportDefinitionId: string,
      expectedRevision: number,
      actorId?: string,
    ) {
      return db.transaction(async (transaction) => {
        const [definition] = await transaction
          .select()
          .from(reportDefinitions)
          .where(eq(reportDefinitions.id, reportDefinitionId))
          .limit(1)
          .for("update")
        if (!definition) throw new ReportingRecordNotFoundError("Report definition")
        if (definition.revision !== expectedRevision)
          throw new ReportDefinitionRevisionConflictError()
        const [latest] = await transaction
          .select({ version: reportVersions.version })
          .from(reportVersions)
          .where(eq(reportVersions.reportDefinitionId, reportDefinitionId))
          .orderBy(desc(reportVersions.version))
          .limit(1)
        const [version] = await transaction
          .insert(reportVersions)
          .values({
            reportDefinitionId,
            version: (latest?.version ?? 0) + 1,
            name: definition.name,
            description: definition.description,
            definitionRevision: definition.revision,
            snapshot: registry.snapshotDraft(definition.draft),
            createdByUserId: actorId,
          })
          .returning()
        if (!version) throw new Error("Report version insert returned no row.")
        return version
      })
    },

    async runVersion(
      db: PostgresJsDatabase,
      versionId: string,
      parameters: ReportParameters,
      context: { actorId?: string; grantedScopes: readonly string[]; signal?: AbortSignal },
    ) {
      const execution = await db.transaction(async (transaction) => {
        const [version] = await transaction
          .select()
          .from(reportVersions)
          .where(eq(reportVersions.id, versionId))
          .limit(1)
          .for("share")
        if (!version) throw new ReportingRecordNotFoundError("Report version")
        for (const resolved of registry.resolveDraft(version.snapshot, "edit")) {
          if (resolved.status === "missing" || !resolved.definition) continue
          registry.validateQuery(resolved.definition.query, context.grantedScopes)
        }
        const [run] = await transaction
          .insert(reportRuns)
          .values({ reportVersionId: versionId, parameters, triggeredByUserId: context.actorId })
          .returning()
        if (!run) throw new Error("Report run insert returned no row.")
        return { run, version }
      })
      const { run, version } = execution

      try {
        const executionSignal = context.signal
          ? AbortSignal.any([context.signal, AbortSignal.timeout(60_000)])
          : AbortSignal.timeout(60_000)
        const output = await executeDraft(registry, db, version.snapshot, parameters, {
          ...context,
          signal: executionSignal,
        })
        const failed = output.widgets.some((widget) => widget.status === "failed")
        const [completed] = await db
          .update(reportRuns)
          .set({
            status: failed ? "failed" : "succeeded",
            output,
            error: failed ? "One or more widgets failed." : null,
            completedAt: new Date(),
          })
          .where(eq(reportRuns.id, run.id))
          .returning()
        return completed ?? run
      } catch (error) {
        const message = error instanceof Error ? error.message : "Report execution failed."
        const [failed] = await db
          .update(reportRuns)
          .set({ status: "failed", error: message, completedAt: new Date() })
          .where(eq(reportRuns.id, run.id))
          .returning()
        return failed ?? run
      }
    },

    async getRun(db: PostgresJsDatabase, id: string, grantedScopes: readonly string[]) {
      const [run] = await db.select().from(reportRuns).where(eq(reportRuns.id, id)).limit(1)
      if (run) {
        const requiredScopes = [
          ...new Set(run.output?.widgets.flatMap((widget) => widget.requiredScopes ?? []) ?? []),
        ]
        registry.requireScopes(requiredScopes, grantedScopes)
      }
      return run ?? null
    },
  }
}

async function executeDraft(
  registry: ReportingRegistry,
  db: PostgresJsDatabase,
  draft: ReportDraft,
  runParameters: ReportParameters,
  context: { actorId?: string; grantedScopes: readonly string[]; signal?: AbortSignal },
): Promise<ReportRunOutput> {
  const parameters = { ...draft.parameters, ...runParameters }
  const widgets: ReportRunOutput["widgets"] = []
  for (const resolved of registry.resolveDraft(draft, "edit")) {
    if (resolved.status === "missing" || !resolved.definition) {
      widgets.push({
        widgetInstanceId: resolved.instance.id,
        status: "missing",
        reason: resolved.missingReason ?? "Widget is unavailable.",
      })
      continue
    }
    let provenance:
      | { datasetId: string; datasetVersion: number; requiredScopes: readonly string[] }
      | undefined
    try {
      const validation = registry.validateQuery(resolved.definition.query, context.grantedScopes)
      provenance = {
        datasetId: validation.dataset.definition.id,
        datasetVersion: validation.dataset.definition.version,
        requiredScopes: validation.requiredScopes,
      }
      const result = await registry.executeQuery({
        db,
        actorId: context.actorId,
        grantedScopes: context.grantedScopes,
        query: resolved.definition.query,
        parameters,
        signal: context.signal,
      })
      widgets.push({
        widgetInstanceId: resolved.instance.id,
        status: "succeeded",
        ...provenance,
        result,
      })
    } catch (error) {
      widgets.push({
        widgetInstanceId: resolved.instance.id,
        status: "failed",
        ...provenance,
        reason: error instanceof Error ? error.message : "Widget execution failed.",
      })
    }
  }
  return { widgets }
}
