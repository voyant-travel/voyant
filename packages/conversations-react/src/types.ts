export interface InboxConversation {
  id: string
  inboxId: string
  assignedToUserId: string | null
  priority: "low" | "normal" | "high" | "urgent"
  revision: number
  status: "open" | "closed" | "snoozed"
  subject: string | null
  suggestedSubject: string | null
  customerAddress: string
  personRef: string | null
  unreadCount: number
  lastPartAt: string
}

export interface InboxPart {
  id: string
  sequence: number
  direction: "inbound" | "outbound"
  senderAddress: string
  textBody: string | null
  htmlBody: string | null
  contentStatus: "safe" | "quarantined" | "redacted"
  legacyAttachmentCount: number
  classification: "message" | "automatic_reply" | "delivery_status" | "complaint" | "suspicious"
  replyable: boolean
  attachments: InboxAttachment[]
  deliveryStatus: string
  occurredAt: string
}

export interface InboxNote {
  id: string
  authorUserId: string
  body: string
  createdAt: string
}

export interface ConversationInbox {
  id: string
  name: string
  description: string | null
  isDefault: boolean
}

export interface AssignableStaff {
  userId: string
  displayName: string
}

export interface InboxAttachment {
  id: string
  filename: string
  contentType: string
  sizeBytes: number
  disposition: "attachment" | "inline"
  scanStatus: "pending" | "clean" | "blocked" | "failed"
  availability: "active" | "quarantined" | "redaction_pending" | "redacted"
}

export interface InboxConversationDetail {
  conversation: InboxConversation
  parts: InboxPart[]
  notes: InboxNote[]
  timeline: Array<
    | { kind: "part"; occurredAt: string; id: string; part: InboxPart }
    | { kind: "note"; occurredAt: string; id: string; note: InboxNote }
    | {
        kind: "system"
        occurredAt: string
        id: string
        event: { type: string; actorUserId: string | null; revision: number }
      }
  >
}
