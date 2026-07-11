import { bookings } from "@voyant-travel/bookings/schema"
import type { EventBus } from "@voyant-travel/core"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

interface StoredAcceptance {
  templateId: string
  templateSlug: string
  acceptedAt: string
  acceptedMarketing: boolean
  clientIp?: string
  userAgent?: string
  renderedHtmlLength: number
}

export interface AcceptanceSignatureContract {
  id: string
  bookingId: string | null
  metadata: unknown
  status: string
}

export interface AcceptanceSignatureInput {
  signerName: string
  signerEmail: string | null
  method: "electronic"
  ipAddress: string | null
  userAgent: string | null
  metadata: Record<string, unknown>
}

/** Legal operations required by checkout acceptance-signature promotion. */
export interface AcceptanceSignatureLegalPort {
  getContract(
    db: PostgresJsDatabase,
    contractId: string,
  ): Promise<AcceptanceSignatureContract | null>
  listSignatures(db: PostgresJsDatabase, contractId: string): Promise<ReadonlyArray<unknown>>
  sendContract(
    db: PostgresJsDatabase,
    contractId: string,
    eventBus?: EventBus,
  ): Promise<{ status: string }>
  signContract(
    db: PostgresJsDatabase,
    contractId: string,
    input: AcceptanceSignatureInput,
    eventBus?: EventBus,
  ): Promise<{ status: string }>
}

const ACCEPTANCE_MARKER_PREFIX = "__contract_acceptance__:"

function readContractAcceptance(
  contractMetadata: unknown,
  internalNotesFallback: string | null,
): StoredAcceptance | null {
  if (contractMetadata && typeof contractMetadata === "object") {
    const meta = contractMetadata as Record<string, unknown>
    if (meta.acceptance && typeof meta.acceptance === "object") {
      return meta.acceptance as StoredAcceptance
    }
  }
  if (!internalNotesFallback) return null
  for (const line of internalNotesFallback.split("\n")) {
    if (!line.startsWith(ACCEPTANCE_MARKER_PREFIX)) continue
    try {
      return JSON.parse(line.slice(ACCEPTANCE_MARKER_PREFIX.length)) as StoredAcceptance
    } catch {
      // Bad marker - try next line.
    }
  }
  return null
}

export async function persistAcceptanceSignature(
  db: PostgresJsDatabase,
  contractId: string,
  eventBus?: EventBus,
  legalPort?: AcceptanceSignatureLegalPort,
): Promise<void> {
  const legal = legalPort ?? (await createDefaultAcceptanceSignatureLegalPort())
  const contract = await legal.getContract(db, contractId)
  if (!contract?.bookingId) return

  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, contract.bookingId))
    .limit(1)
  if (!booking) return

  const acceptance = readContractAcceptance(contract.metadata, booking.internalNotes)
  if (!acceptance) return

  const existing = await legal.listSignatures(db, contractId)
  if (existing.length > 0) return

  if (contract.status === "issued") {
    const sent = await legal.sendContract(db, contractId, eventBus)
    if (sent.status !== "sent") {
      console.warn(
        `[catalog-checkout] could not send contract before acceptance signature for ${contractId}: ${sent.status}`,
      )
      return
    }
  }

  const contactName = [booking.contactFirstName, booking.contactLastName]
    .filter(Boolean)
    .join(" ")
    .trim()
  const signerName =
    contactName ||
    `Storefront customer${booking.bookingNumber ? ` (${booking.bookingNumber})` : ""}`

  const result = await legal.signContract(
    db,
    contractId,
    {
      signerName,
      signerEmail: booking.contactEmail ?? null,
      method: "electronic" as const,
      ipAddress: acceptance.clientIp ? acceptance.clientIp.slice(0, 64) : null,
      userAgent: acceptance.userAgent ? acceptance.userAgent.slice(0, 500) : null,
      metadata: {
        source: "storefront-checkout",
        templateId: acceptance.templateId,
        templateSlug: acceptance.templateSlug,
        acceptedAt: acceptance.acceptedAt,
        acceptedMarketing: acceptance.acceptedMarketing,
        renderedHtmlLength: acceptance.renderedHtmlLength,
      },
    },
    eventBus,
  )

  if (result.status !== "signed") {
    console.warn(
      `[catalog-checkout] could not record acceptance signature for ${contractId}: ${result.status}`,
    )
    return
  }

  if (booking.internalNotes?.includes(ACCEPTANCE_MARKER_PREFIX)) {
    const cleanedNotes = booking.internalNotes
      .split("\n")
      .filter((line: string) => !line.startsWith(ACCEPTANCE_MARKER_PREFIX))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
    await db
      .update(bookings)
      .set({
        internalNotes: cleanedNotes.length > 0 ? cleanedNotes : null,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, booking.id))
  }
}

async function createDefaultAcceptanceSignatureLegalPort(): Promise<AcceptanceSignatureLegalPort> {
  const { contracts: contractsTable, contractsService } = await import(
    "@voyant-travel/legal/contracts"
  )

  return {
    async getContract(db, contractId) {
      const [contract] = await db
        .select()
        .from(contractsTable)
        .where(eq(contractsTable.id, contractId))
        .limit(1)
      return contract ?? null
    },
    listSignatures: (db, contractId) => contractsService.listSignatures(db, contractId),
    sendContract: (db, contractId, eventBus) =>
      contractsService.sendContract(db, contractId, { eventBus }),
    signContract: (db, contractId, input, eventBus) =>
      contractsService.signContract(db, contractId, input as never, { eventBus }),
  }
}
