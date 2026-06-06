import { asc, eq, inArray, or, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { z } from "zod"

import {
  type NotificationTemplate,
  notificationReminderRuleAuthoringRequests,
  notificationReminderRuleStages,
  notificationReminderRules,
  notificationReminderStageChannels,
  notificationTemplates,
} from "./schema.js"
import type { composeNotificationReminderRuleSchema } from "./validation.js"

export interface ReminderRuleAuthoringIssue {
  code: string
  field?: string
  message: string
  fix?: string
}

export type ComposeNotificationReminderRuleInput = z.infer<
  typeof composeNotificationReminderRuleSchema
>

export type ComposeNotificationReminderRuleResult = {
  ruleId: string
  stages: Array<{
    id: string
    orderIndex: number
    channels: Array<{
      id: string
      orderIndex: number
    }>
  }>
}

export type ComposeNotificationReminderRuleOutcome =
  | { status: "ok"; result: ComposeNotificationReminderRuleResult; reused: boolean }
  | { status: "invalid"; issues: ReminderRuleAuthoringIssue[] }

type TemplateRef = {
  templateId?: string | null
  templateSlug?: string | null
}

type ResolvedTemplateRef = {
  id: string
  slug: string
  channel: NotificationTemplate["channel"]
}

type NormalizedTemplateRef = {
  templateId: string
  templateSlug: string
  template: ResolvedTemplateRef
}

function field(path: Array<string | number>) {
  return path
    .map((segment) => (typeof segment === "number" ? `[${segment}]` : segment))
    .join(".")
    .replaceAll(".[", "[")
}

function issue(
  issues: ReminderRuleAuthoringIssue[],
  code: string,
  path: Array<string | number>,
  message: string,
  fix: string,
) {
  issues.push({ code, field: field(path), message, fix })
}

async function resolveTemplateRefs(
  db: PostgresJsDatabase,
  refs: TemplateRef[],
): Promise<Map<string, ResolvedTemplateRef>> {
  const ids = [...new Set(refs.map((ref) => ref.templateId).filter((id): id is string => !!id))]
  const slugs = [
    ...new Set(refs.map((ref) => ref.templateSlug).filter((slug): slug is string => !!slug)),
  ]

  if (ids.length === 0 && slugs.length === 0) {
    return new Map()
  }

  const rows = await db
    .select({
      id: notificationTemplates.id,
      slug: notificationTemplates.slug,
      channel: notificationTemplates.channel,
    })
    .from(notificationTemplates)
    .where(
      or(
        ids.length > 0 ? inArray(notificationTemplates.id, ids) : undefined,
        slugs.length > 0 ? inArray(notificationTemplates.slug, slugs) : undefined,
      ),
    )

  const resolved = new Map<string, ResolvedTemplateRef>()
  for (const row of rows) {
    resolved.set(`id:${row.id}`, row)
    resolved.set(`slug:${row.slug}`, row)
  }
  return resolved
}

function normalizeTemplateRef(
  ref: TemplateRef,
  path: Array<string | number>,
  resolved: Map<string, ResolvedTemplateRef>,
  issues: ReminderRuleAuthoringIssue[],
): NormalizedTemplateRef | null {
  const idMatch = ref.templateId ? resolved.get(`id:${ref.templateId}`) : null
  const slugMatch = ref.templateSlug ? resolved.get(`slug:${ref.templateSlug}`) : null

  if (ref.templateId && !idMatch) {
    issue(
      issues,
      "template_not_found",
      [...path, "templateId"],
      `Notification template "${ref.templateId}" was not found.`,
      "Use an existing templateId or omit it and provide a resolvable templateSlug.",
    )
  }
  if (ref.templateSlug && !slugMatch) {
    issue(
      issues,
      "template_not_found",
      [...path, "templateSlug"],
      `Notification template "${ref.templateSlug}" was not found.`,
      "Use an existing templateSlug or omit it and provide a resolvable templateId.",
    )
  }
  if (idMatch && slugMatch && idMatch.id !== slugMatch.id) {
    issue(
      issues,
      "template_ref_mismatch",
      path,
      "templateId and templateSlug resolve to different notification templates.",
      "Keep only one template reference or make both references point at the same template.",
    )
  }

  const template = idMatch ?? slugMatch
  if (!template) return null

  return {
    templateId: template.id,
    templateSlug: template.slug,
    template,
  }
}

async function validateAndNormalizeComposeInput(
  db: PostgresJsDatabase,
  input: ComposeNotificationReminderRuleInput,
): Promise<
  | {
      ok: true
      input: ComposeNotificationReminderRuleInput
      ruleTemplate: NormalizedTemplateRef | null
      channels: NormalizedTemplateRef[][]
    }
  | { ok: false; issues: ReminderRuleAuthoringIssue[] }
> {
  const issues: ReminderRuleAuthoringIssue[] = []
  const refs: TemplateRef[] = [input.rule]
  for (const stage of input.stages) {
    refs.push(...stage.channels)
  }
  const resolved = await resolveTemplateRefs(db, refs)
  const ruleTemplate = normalizeTemplateRef(input.rule, ["rule"], resolved, issues)

  const stageOrderIndexes = new Set<number>()
  const normalizedChannels: NormalizedTemplateRef[][] = []

  input.stages.forEach((stage, stageIndex) => {
    const stagePath = ["stages", stageIndex]
    if (stageOrderIndexes.has(stage.orderIndex)) {
      issue(
        issues,
        "duplicate_stage_order",
        [...stagePath, "orderIndex"],
        `Stage orderIndex ${stage.orderIndex} is used more than once.`,
        "Give each stage a unique orderIndex.",
      )
    }
    stageOrderIndexes.add(stage.orderIndex)

    if (stage.windowEndDays < stage.windowStartDays) {
      issue(
        issues,
        "invalid_stage_window",
        [...stagePath, "windowEndDays"],
        "windowEndDays must be greater than or equal to windowStartDays.",
        "Set windowEndDays to the same value as windowStartDays or a later day offset.",
      )
    }
    if (stage.cadenceKind === "every_n_days" && !stage.cadenceEveryDays) {
      issue(
        issues,
        "cadence_every_days_required",
        [...stagePath, "cadenceEveryDays"],
        "cadenceEveryDays is required when cadenceKind is every_n_days.",
        "Set cadenceEveryDays to a positive integer or change cadenceKind.",
      )
    }
    if (
      stage.cadenceKind === "escalating" &&
      (!stage.cadenceIntervals || stage.cadenceIntervals.length === 0)
    ) {
      issue(
        issues,
        "cadence_intervals_required",
        [...stagePath, "cadenceIntervals"],
        "cadenceIntervals is required when cadenceKind is escalating.",
        "Provide at least one escalation interval or change cadenceKind.",
      )
    }

    const channelOrderIndexes = new Set<number>()
    normalizedChannels[stageIndex] = []

    stage.channels.forEach((channel, channelIndex) => {
      const channelPath = [...stagePath, "channels", channelIndex]
      if (channelOrderIndexes.has(channel.orderIndex)) {
        issue(
          issues,
          "duplicate_channel_order",
          [...channelPath, "orderIndex"],
          `Channel orderIndex ${channel.orderIndex} is used more than once in this stage.`,
          "Give each channel in the stage a unique orderIndex.",
        )
      }
      channelOrderIndexes.add(channel.orderIndex)

      if (channel.channel !== input.rule.channel) {
        issue(
          issues,
          "channel_mismatch",
          [...channelPath, "channel"],
          `Stage channel "${channel.channel}" does not match rule channel "${input.rule.channel}".`,
          "Use the same channel on the rule and all stage channels.",
        )
      }

      const channelTemplate =
        normalizeTemplateRef(channel, channelPath, resolved, issues) ?? ruleTemplate
      if (!channelTemplate) {
        issue(
          issues,
          "template_required",
          channelPath,
          "Each stage channel needs a resolvable template from the channel or rule default.",
          "Set templateId or templateSlug on this channel, or set a rule-level template.",
        )
        return
      }

      if (channelTemplate.template.channel !== channel.channel) {
        issue(
          issues,
          "template_channel_mismatch",
          channel.templateId || channel.templateSlug ? channelPath : ["rule"],
          `Template "${channelTemplate.template.slug}" is ${channelTemplate.template.channel}, but the channel is ${channel.channel}.`,
          "Use a template whose channel matches the stage channel.",
        )
      }

      normalizedChannels[stageIndex]![channelIndex] = channelTemplate
    })
  })

  if (ruleTemplate && ruleTemplate.template.channel !== input.rule.channel) {
    issue(
      issues,
      "template_channel_mismatch",
      ["rule"],
      `Rule template "${ruleTemplate.template.slug}" is ${ruleTemplate.template.channel}, but the rule channel is ${input.rule.channel}.`,
      "Use a rule-level template whose channel matches the rule channel.",
    )
  }

  if (issues.length > 0) {
    return { ok: false, issues }
  }

  return { ok: true, input, ruleTemplate, channels: normalizedChannels }
}

async function loadComposeResult(
  db: PostgresJsDatabase,
  ruleId: string,
): Promise<ComposeNotificationReminderRuleResult> {
  const stages = await db
    .select({
      id: notificationReminderRuleStages.id,
      orderIndex: notificationReminderRuleStages.orderIndex,
    })
    .from(notificationReminderRuleStages)
    .where(eq(notificationReminderRuleStages.reminderRuleId, ruleId))
    .orderBy(asc(notificationReminderRuleStages.orderIndex))

  const stageIds = stages.map((stage) => stage.id)
  const channels =
    stageIds.length > 0
      ? await db
          .select({
            id: notificationReminderStageChannels.id,
            stageId: notificationReminderStageChannels.stageId,
            orderIndex: notificationReminderStageChannels.orderIndex,
          })
          .from(notificationReminderStageChannels)
          .where(inArray(notificationReminderStageChannels.stageId, stageIds))
          .orderBy(
            asc(notificationReminderStageChannels.stageId),
            asc(notificationReminderStageChannels.orderIndex),
          )
      : []

  return {
    ruleId,
    stages: stages.map((stage) => ({
      id: stage.id,
      orderIndex: stage.orderIndex,
      channels: channels
        .filter((channel) => channel.stageId === stage.id)
        .map((channel) => ({ id: channel.id, orderIndex: channel.orderIndex })),
    })),
  }
}

async function withIdempotency(
  tx: PostgresJsDatabase,
  key: string | undefined,
  build: () => Promise<ComposeNotificationReminderRuleResult>,
): Promise<{ result: ComposeNotificationReminderRuleResult; reused: boolean }> {
  if (!key) {
    return { result: await build(), reused: false }
  }

  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`)

  const [existing] = await tx
    .select({ reminderRuleId: notificationReminderRuleAuthoringRequests.reminderRuleId })
    .from(notificationReminderRuleAuthoringRequests)
    .where(eq(notificationReminderRuleAuthoringRequests.idempotencyKey, key))
    .limit(1)

  if (existing) {
    return { result: await loadComposeResult(tx, existing.reminderRuleId), reused: true }
  }

  const result = await build()
  await tx.insert(notificationReminderRuleAuthoringRequests).values({
    idempotencyKey: key,
    reminderRuleId: result.ruleId,
    operation: "compose",
  })

  return { result, reused: false }
}

async function buildReminderRuleGraph(
  tx: PostgresJsDatabase,
  normalized: Extract<Awaited<ReturnType<typeof validateAndNormalizeComposeInput>>, { ok: true }>,
): Promise<ComposeNotificationReminderRuleResult> {
  const [rule] = await tx
    .insert(notificationReminderRules)
    .values({
      slug: normalized.input.rule.slug,
      name: normalized.input.rule.name,
      status: normalized.input.rule.status,
      targetType: normalized.input.rule.targetType,
      channel: normalized.input.rule.channel,
      provider: normalized.input.rule.provider ?? null,
      templateId: normalized.ruleTemplate?.templateId ?? null,
      templateSlug: normalized.ruleTemplate?.templateSlug ?? null,
      priority: normalized.input.rule.priority,
      suppressionGroup: normalized.input.rule.suppressionGroup ?? null,
      isSystem: normalized.input.rule.isSystem,
      metadata: normalized.input.rule.metadata ?? null,
    })
    .returning({ id: notificationReminderRules.id })

  if (!rule) throw new Error("Failed to create notification reminder rule")

  const result: ComposeNotificationReminderRuleResult = { ruleId: rule.id, stages: [] }

  for (let stageIndex = 0; stageIndex < normalized.input.stages.length; stageIndex += 1) {
    const stage = normalized.input.stages[stageIndex]!
    const [stageRow] = await tx
      .insert(notificationReminderRuleStages)
      .values({
        reminderRuleId: rule.id,
        orderIndex: stage.orderIndex,
        name: stage.name ?? null,
        anchor: stage.anchor,
        windowStartDays: stage.windowStartDays,
        windowEndDays: stage.windowEndDays,
        cadenceKind: stage.cadenceKind,
        cadenceEveryDays: stage.cadenceEveryDays ?? null,
        cadenceIntervals: stage.cadenceIntervals ?? null,
        maxSendsInStage: stage.maxSendsInStage ?? null,
        respectQuietHours: stage.respectQuietHours,
        metadata: stage.metadata ?? null,
      })
      .returning({ id: notificationReminderRuleStages.id })

    if (!stageRow) throw new Error("Failed to create notification reminder stage")

    const stageResult: ComposeNotificationReminderRuleResult["stages"][number] = {
      id: stageRow.id,
      orderIndex: stage.orderIndex,
      channels: [],
    }

    for (let channelIndex = 0; channelIndex < stage.channels.length; channelIndex += 1) {
      const channel = stage.channels[channelIndex]!
      const template = normalized.channels[stageIndex]![channelIndex]!
      const [channelRow] = await tx
        .insert(notificationReminderStageChannels)
        .values({
          stageId: stageRow.id,
          orderIndex: channel.orderIndex,
          channel: channel.channel,
          provider: channel.provider ?? null,
          templateId: template.templateId,
          templateSlug: template.templateSlug,
          recipientKind: channel.recipientKind,
          recipientRole: channel.recipientRole ?? null,
          metadata: channel.metadata ?? null,
        })
        .returning({
          id: notificationReminderStageChannels.id,
          orderIndex: notificationReminderStageChannels.orderIndex,
        })

      if (!channelRow) throw new Error("Failed to create notification reminder stage channel")
      stageResult.channels.push({ id: channelRow.id, orderIndex: channelRow.orderIndex })
    }

    result.stages.push(stageResult)
  }

  return result
}

export async function composeNotificationReminderRule(
  db: PostgresJsDatabase,
  input: ComposeNotificationReminderRuleInput,
  options: { idempotencyKey?: string } = {},
): Promise<ComposeNotificationReminderRuleOutcome> {
  const normalized = await validateAndNormalizeComposeInput(db, input)
  if (!normalized.ok) return { status: "invalid", issues: normalized.issues }

  const { result, reused } = await db.transaction((tx) =>
    withIdempotency(tx, options.idempotencyKey ?? input.idempotencyKey, () =>
      buildReminderRuleGraph(tx, normalized),
    ),
  )

  return { status: "ok", result, reused }
}
