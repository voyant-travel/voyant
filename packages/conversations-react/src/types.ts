export interface InboxConversation {
  id: string
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
  direction: "inbound" | "outbound"
  senderAddress: string
  textBody: string | null
  htmlBody: string | null
  deliveryStatus: string
  occurredAt: string
}

export interface InboxConversationDetail {
  conversation: InboxConversation
  parts: InboxPart[]
}
