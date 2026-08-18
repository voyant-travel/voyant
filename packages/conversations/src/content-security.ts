import sanitizeHtml from "sanitize-html"

export const CONVERSATION_ATTACHMENT_LIMITS = {
  maxCount: 10,
  maxFileBytes: 25 * 1024 * 1024,
  maxTotalBytes: 50 * 1024 * 1024,
  maxFilenameLength: 255,
} as const

const BLOCKED_CONTENT_TYPES = new Set([
  "application/java-archive",
  "application/vnd.microsoft.portable-executable",
  "application/x-bat",
  "application/x-dosexec",
  "application/x-executable",
  "application/x-httpd-php",
  "application/x-msdownload",
  "application/x-sh",
  "application/x-shellscript",
  "text/html",
  "image/svg+xml",
])
const EXTENSION_CONTENT_TYPES: Readonly<Record<string, readonly string[]>> = {
  pdf: ["application/pdf"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  gif: ["image/gif"],
  webp: ["image/webp"],
  txt: ["text/plain"],
  csv: ["text/csv", "application/csv"],
  json: ["application/json"],
  zip: ["application/zip", "application/x-zip-compressed"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
}

/**
 * Sanitize untrusted customer and staff HTML before it crosses a persistence or
 * delivery boundary. Remote images, CSS, forms, and active/embed content are not
 * allowed because an Inbox view must not become a tracking or execution surface.
 */
export function sanitizeConversationHtml(value: string | null | undefined): string | null {
  if (!value) return null
  const sanitized = sanitizeHtml(value, {
    allowedTags: [
      "p",
      "br",
      "div",
      "span",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "blockquote",
      "pre",
      "code",
      "ul",
      "ol",
      "li",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "a",
    ],
    allowedAttributes: { a: ["href", "title", "rel"] },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesAppliedToAttributes: ["href"],
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    enforceHtmlBoundary: true,
    transformTags: {
      a: (_tagName, attributes) => ({
        tagName: "a",
        attribs: {
          ...(attributes.href ? { href: attributes.href } : {}),
          ...(attributes.title ? { title: attributes.title } : {}),
          rel: "noopener noreferrer",
        },
      }),
    },
  }).trim()
  return sanitized || null
}

export interface AttachmentMetadataInput {
  filename: string
  contentType: string
  sizeBytes: number
}

export class ConversationAttachmentPolicyError extends Error {
  readonly code = "attachment_policy_rejected"
}

export function normalizeAttachmentMetadata(input: AttachmentMetadataInput) {
  const filename = input.filename
    .normalize("NFKC")
    .split("")
    .map((character) => {
      const code = character.charCodeAt(0)
      return code < 32 || code === 127 || character === "/" || character === "\\" ? "_" : character
    })
    .join("")
    .trim()
  const contentType = input.contentType.split(";", 1)[0]!.trim().toLowerCase()
  if (!filename || filename === "." || filename === "..") {
    throw new ConversationAttachmentPolicyError("Attachment filename is invalid")
  }
  if (filename.length > CONVERSATION_ATTACHMENT_LIMITS.maxFilenameLength) {
    throw new ConversationAttachmentPolicyError("Attachment filename is too long")
  }
  if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes < 0) {
    throw new ConversationAttachmentPolicyError("Attachment size is invalid")
  }
  if (input.sizeBytes > CONVERSATION_ATTACHMENT_LIMITS.maxFileBytes) {
    throw new ConversationAttachmentPolicyError("Attachment exceeds the per-file size limit")
  }
  if (!contentType || BLOCKED_CONTENT_TYPES.has(contentType)) {
    throw new ConversationAttachmentPolicyError("Attachment content type is not allowed")
  }
  const extension = filename.includes(".") ? filename.split(".").pop()?.toLowerCase() : undefined
  const allowedForExtension = extension ? EXTENSION_CONTENT_TYPES[extension] : undefined
  if (allowedForExtension && !allowedForExtension.includes(contentType)) {
    throw new ConversationAttachmentPolicyError("Attachment extension and content type disagree")
  }
  return { filename, contentType, sizeBytes: input.sizeBytes }
}

export function assertDetectedAttachmentMetadata(input: {
  filename: string
  declaredContentType: string
  declaredSizeBytes: number
  detectedContentType?: string
  detectedSizeBytes?: number
}) {
  const declared = normalizeAttachmentMetadata({
    filename: input.filename,
    contentType: input.declaredContentType,
    sizeBytes: input.declaredSizeBytes,
  })
  if (input.detectedSizeBytes !== undefined && input.detectedSizeBytes !== declared.sizeBytes) {
    throw new ConversationAttachmentPolicyError("Attachment size does not match its content")
  }
  if (input.detectedContentType) {
    const detected = normalizeAttachmentMetadata({
      filename: input.filename,
      contentType: input.detectedContentType,
      sizeBytes: input.detectedSizeBytes ?? declared.sizeBytes,
    })
    if (detected.contentType !== declared.contentType) {
      throw new ConversationAttachmentPolicyError("Attachment type does not match its content")
    }
  }
  return declared
}

export function assertAttachmentSetPolicy(items: readonly AttachmentMetadataInput[]): void {
  if (items.length > CONVERSATION_ATTACHMENT_LIMITS.maxCount) {
    throw new ConversationAttachmentPolicyError("Too many attachments")
  }
  let total = 0
  for (const item of items) {
    total += normalizeAttachmentMetadata(item).sizeBytes
    if (total > CONVERSATION_ATTACHMENT_LIMITS.maxTotalBytes) {
      throw new ConversationAttachmentPolicyError("Attachments exceed the total size limit")
    }
  }
}
