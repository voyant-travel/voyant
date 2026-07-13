import { z } from "zod/v4"
import type { NotificationsUiMessages } from "../i18n/index.js"

export const CHANNEL_VALUES = ["email", "sms"] as const
export const STATUS_VALUES = ["draft", "active", "archived"] as const
export const ATTACHMENT_VALUES = ["contract", "invoice", "brochure"] as const

export const channelItemLabel = (
  t: NotificationsUiMessages["admin"]["common"],
  value: (typeof CHANNEL_VALUES)[number],
) => (value === "email" ? t.channelEmail : t.channelSms)

export const statusItemLabel = (
  t: NotificationsUiMessages["admin"]["common"],
  value: (typeof STATUS_VALUES)[number],
) => (value === "draft" ? t.statusDraft : value === "active" ? t.statusActive : t.statusArchived)

export const attachmentItemLabel = (
  t: NotificationsUiMessages["admin"]["templateDialog"],
  value: (typeof ATTACHMENT_VALUES)[number],
) =>
  value === "contract"
    ? t.attachmentContract
    : value === "invoice"
      ? t.attachmentInvoice
      : t.attachmentBrochure

export const nativeSelectClassName =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"

const templateAttachmentSchema = z.enum(["contract", "invoice", "brochure"])

export const templateFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Must be kebab-case"),
  channel: z.enum(["email", "sms"]),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
  subjectTemplate: z.string().optional(),
  htmlTemplate: z.string().optional(),
  textTemplate: z.string().optional(),
  fromAddress: z.string().optional(),
  attachments: z.array(templateAttachmentSchema).default([]),
  active: z.boolean(),
})

export type FormValues = z.input<typeof templateFormSchema>
export type FormOutput = z.output<typeof templateFormSchema>
export type TemplateAttachment = z.infer<typeof templateAttachmentSchema>

export function resolveTemplateMutationStatus({
  active,
  status,
}: Pick<FormOutput, "active" | "status">): FormOutput["status"] {
  if (status === "draft" && active) {
    return "active"
  }

  return status
}

type SamplePayloadVariable = {
  key: string
  example: string
  type?: string
}

function parsePath(path: string) {
  return path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean)
}

function isContainer(value: unknown): value is Record<string, unknown> | unknown[] {
  return typeof value === "object" && value != null
}

function coerceSampleValue(variable: SamplePayloadVariable) {
  switch (variable.type) {
    case "array":
      return []
    case "boolean":
      return variable.example === "true"
    case "currency":
    case "number": {
      const value = Number(variable.example)
      return Number.isFinite(value) ? value : variable.example
    }
    default:
      return variable.example
  }
}

function setDeepValue(target: Record<string, unknown>, path: string, value: unknown) {
  const segments = parsePath(path)
  let current: unknown = target

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]!
    const isLast = index === segments.length - 1
    const nextSegment = segments[index + 1]
    const nextIsIndex = nextSegment ? /^\d+$/.test(nextSegment) : false

    if (Array.isArray(current)) {
      const arrayIndex = Number(segment)
      if (Number.isNaN(arrayIndex)) return
      if (isLast) {
        current[arrayIndex] = value
        return
      }
      const currentValue = current[arrayIndex]
      if (
        !isContainer(currentValue) ||
        (nextIsIndex ? !Array.isArray(currentValue) : Array.isArray(currentValue))
      ) {
        current[arrayIndex] = nextIsIndex ? [] : {}
      }
      current = current[arrayIndex] as Record<string, unknown> | unknown[]
      continue
    }

    if (typeof current !== "object" || current == null) return
    const record = current as Record<string, unknown>
    if (isLast) {
      record[segment] = value
      return
    }
    const currentValue = record[segment]
    if (
      !isContainer(currentValue) ||
      (nextIsIndex ? !Array.isArray(currentValue) : Array.isArray(currentValue))
    ) {
      record[segment] = nextIsIndex ? [] : {}
    }
    current = record[segment] as Record<string, unknown> | unknown[]
  }
}

export function buildSamplePayload(
  variableGroups: Array<{
    variables: SamplePayloadVariable[]
  }>,
) {
  const sample: Record<string, unknown> = {}
  for (const group of variableGroups) {
    for (const variable of group.variables) {
      setDeepValue(sample, variable.key, coerceSampleValue(variable))
    }
  }
  return sample
}

export function resolvePreviewDataInput(input: string, fallback: string) {
  return input.trim() ? input : fallback
}

function getMetadataRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

export function readTemplateAttachments(metadata: unknown): TemplateAttachment[] {
  const record = getMetadataRecord(metadata)
  const value = record?.attachments
  if (!Array.isArray(value)) {
    return []
  }

  const allowed = new Set(ATTACHMENT_VALUES)
  return ATTACHMENT_VALUES.filter(
    (attachment) => allowed.has(attachment) && value.includes(attachment),
  )
}

export function buildTemplateMetadata(
  metadata: unknown,
  attachments: ReadonlyArray<TemplateAttachment>,
): Record<string, unknown> | null {
  const current = getMetadataRecord(metadata)
  const next = current ? { ...current } : {}

  if (attachments.length > 0) {
    next.attachments = [...attachments]
  } else {
    delete next.attachments
  }

  return Object.keys(next).length > 0 ? next : null
}
