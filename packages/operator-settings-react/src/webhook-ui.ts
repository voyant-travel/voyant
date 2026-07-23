import { useLocale } from "@voyant-travel/admin/providers/locale"

export interface WebhookSubscriptionRecord {
  id: string
  url: string
  events: string[]
  active: boolean
  maxRetries: number
  headers: Record<string, string> | null
  description: string | null
  createdAt: string
  updatedAt: string
  lastDeliveryAt: string | null
  failureCount: number
}

export interface WebhookEventRecord {
  id: string
  eventType: string
  version: string
  payloadSchema: Record<string, unknown>
}

export interface WebhookDeliveryRecord {
  id: string
  subscriptionId: string | null
  sourceEvent: string
  targetUrl: string
  status: "pending" | "in_flight" | "succeeded" | "failed" | "abandoned"
  attemptNumber: number
  responseStatus: number | null
  errorMessage: string | null
  createdAt: string
  finishedAt: string | null
}

interface WebhookMessages {
  title: string
  description: string
  add: string
  empty: string
  endpoint: string
  descriptionLabel: string
  events: string
  retries: string
  active: string
  inactive: string
  deliveries: string
  create: string
  save: string
  cancel: string
  back: string
  enable: string
  disable: string
  rotate: string
  test: string
  delete: string
  replay: string
  secretTitle: string
  secretHint: string
  loadFailed: string
  saveFailed: string
  deleteConfirm: string
  rotateConfirm: string
  status: string
  event: string
  attempt: string
  response: string
  created: string
  noDeliveries: string
}

const en: WebhookMessages = {
  title: "Webhooks",
  description: "Send selected Voyant business events to your own HTTPS endpoints.",
  add: "Add subscription",
  empty: "No webhook subscriptions yet.",
  endpoint: "Endpoint URL",
  descriptionLabel: "Description",
  events: "Events",
  retries: "Retries",
  active: "Enabled",
  inactive: "Disabled",
  deliveries: "Deliveries",
  create: "Create subscription",
  save: "Save changes",
  cancel: "Cancel",
  back: "Back to webhooks",
  enable: "Enable",
  disable: "Disable",
  rotate: "Rotate secret",
  test: "Send test",
  delete: "Delete",
  replay: "Replay",
  secretTitle: "Save this signing secret",
  secretHint: "This secret is shown only once. Store it securely before closing.",
  loadFailed: "Could not load webhook settings.",
  saveFailed: "Could not save webhook settings.",
  deleteConfirm: "Delete this webhook subscription?",
  rotateConfirm: "Rotate the signing secret? The current secret will stop working.",
  status: "Status",
  event: "Event",
  attempt: "Attempt",
  response: "Response",
  created: "Created",
  noDeliveries: "No deliveries yet.",
}

const ro: WebhookMessages = {
  title: "Webhook-uri",
  description: "Trimite evenimentele de business Voyant selectate catre endpointurile tale HTTPS.",
  add: "Adauga abonament",
  empty: "Nu exista abonamente webhook.",
  endpoint: "URL endpoint",
  descriptionLabel: "Descriere",
  events: "Evenimente",
  retries: "Reincercari",
  active: "Activ",
  inactive: "Inactiv",
  deliveries: "Livrari",
  create: "Creeaza abonamentul",
  save: "Salveaza modificarile",
  cancel: "Anuleaza",
  back: "Inapoi la webhook-uri",
  enable: "Activeaza",
  disable: "Dezactiveaza",
  rotate: "Roteste secretul",
  test: "Trimite test",
  delete: "Sterge",
  replay: "Retrimite",
  secretTitle: "Salveaza acest secret de semnare",
  secretHint: "Secretul este afisat o singura data. Salveaza-l in siguranta inainte de inchidere.",
  loadFailed: "Setarile webhook nu au putut fi incarcate.",
  saveFailed: "Setarile webhook nu au putut fi salvate.",
  deleteConfirm: "Stergi acest abonament webhook?",
  rotateConfirm: "Rotesti secretul de semnare? Secretul curent nu va mai functiona.",
  status: "Stare",
  event: "Eveniment",
  attempt: "Incercare",
  response: "Raspuns",
  created: "Creat",
  noDeliveries: "Nu exista livrari.",
}

export function useWebhookMessages(): WebhookMessages {
  const { resolvedLocale } = useLocale()
  return resolvedLocale?.toLowerCase().startsWith("ro") ? ro : en
}

export async function responseError(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null
  return typeof body?.error === "string" && body.error.trim() ? body.error : fallback
}
