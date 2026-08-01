import { newId } from "@voyant-travel/db/lib/typeid"

import type {
  BookingCommitInternalRecord,
  BookingHoldInternalRecord,
  BookingQuoteInternalRecord,
  BookingSessionInternalRecord,
  BookingSessionModulePorts,
  BookingSessionRepository,
  CommitOwnedBookingInput,
} from "./sessions-service.js"

export interface InMemoryBookingSessionRepository extends BookingSessionRepository {
  sessions: Map<string, BookingSessionInternalRecord>
  quotes: Map<string, BookingQuoteInternalRecord>
  holds: Map<string, BookingHoldInternalRecord>
  commits: Map<string, BookingCommitInternalRecord>
}

export function createInMemoryBookingSessionRepository(): InMemoryBookingSessionRepository {
  const locks = new Map<string, Promise<unknown>>()
  const repository: InMemoryBookingSessionRepository = {
    sessions: new Map(),
    quotes: new Map(),
    holds: new Map(),
    commits: new Map(),

    async createSession(record) {
      repository.sessions.set(record.id, cloneSession(record))
      return cloneSession(record)
    },
    async getSession(sessionId) {
      const session = repository.sessions.get(sessionId)
      return session ? cloneSession(session) : null
    },
    async saveSession(record) {
      repository.sessions.set(record.id, cloneSession(record))
    },
    async listActiveQuotes(sessionId) {
      return [...repository.quotes.values()]
        .filter((quote) => quote.sessionId === sessionId && quote.state === "active")
        .map(cloneQuote)
    },
    async getQuote(quoteId) {
      const quote = repository.quotes.get(quoteId)
      return quote ? cloneQuote(quote) : null
    },
    async saveQuote(record) {
      repository.quotes.set(record.id, cloneQuote(record))
    },
    async getHold(holdId) {
      const hold = repository.holds.get(holdId)
      return hold ? cloneHold(hold) : null
    },
    async saveHold(record) {
      repository.holds.set(record.id, cloneHold(record))
    },
    async getCommitByIdempotency(sessionId, idempotencyKey) {
      const commit = [...repository.commits.values()].find(
        (record) => record.sessionId === sessionId && record.idempotencyKey === idempotencyKey,
      )
      return commit ? cloneCommit(commit) : null
    },
    async saveCommit(record) {
      repository.commits.set(record.id, cloneCommit(record))
    },
    async withSessionTransaction(sessionId, operation) {
      const previous = locks.get(sessionId) ?? Promise.resolve()
      let release: () => void = () => {}
      const current = new Promise<void>((resolve) => {
        release = resolve
      })
      const chained = previous.then(() => current)
      locks.set(sessionId, chained)
      await previous
      try {
        return await operation()
      } finally {
        release()
        if (locks.get(sessionId) === chained) locks.delete(sessionId)
      }
    },
  }
  return repository
}

export interface InMemoryOwnedInventoryPorts
  extends Pick<BookingSessionModulePorts, "placeCapacityHold" | "commitOwnedBooking"> {
  setCapacity(capacityKey: string, quantity: number): void
  bookingIds: string[]
  allocationIds: string[]
}

export function createInMemoryOwnedInventoryPorts(): InMemoryOwnedInventoryPorts {
  const capacities = new Map<string, number>()
  const activeHolds = new Map<string, { capacityKey: string; quantity: number; expiresAt: Date }>()
  const bookingIds: string[] = []
  const allocationIds: string[] = []

  return {
    bookingIds,
    allocationIds,
    setCapacity(capacityKey, quantity) {
      capacities.set(capacityKey, quantity)
    },
    async placeCapacityHold({ holdId, capacityKey, quantity, expiresAt, now }) {
      for (const [id, hold] of activeHolds) {
        if (hold.expiresAt <= now) activeHolds.delete(id)
      }
      const held = [...activeHolds.values()]
        .filter((hold) => hold.capacityKey === capacityKey)
        .reduce((sum, hold) => sum + hold.quantity, 0)
      const capacity = capacities.get(capacityKey) ?? 0
      if (capacity - held < quantity) return "unavailable"
      activeHolds.set(holdId, { capacityKey, quantity, expiresAt })
      return "held"
    },
    async commitOwnedBooking(input: CommitOwnedBookingInput) {
      const active = activeHolds.get(input.hold.id)
      if (!active || active.expiresAt <= input.now) {
        throw new Error("owned inventory hold is not live at commit")
      }
      activeHolds.delete(input.hold.id)
      const remaining = (capacities.get(active.capacityKey) ?? 0) - active.quantity
      if (remaining < 0) throw new Error("owned inventory oversold")
      capacities.set(active.capacityKey, remaining)

      const bookingId = newId("bookings")
      const allocationId = newId("booking_allocations")
      bookingIds.push(bookingId)
      allocationIds.push(allocationId)
      return { bookingId, allocationIds: [allocationId] }
    },
  }
}

function cloneSession(record: BookingSessionInternalRecord): BookingSessionInternalRecord {
  return {
    ...record,
    target: { ...record.target },
    statePayload: { ...record.statePayload },
    expiresAt: new Date(record.expiresAt),
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  }
}

function cloneQuote(record: BookingQuoteInternalRecord): BookingQuoteInternalRecord {
  return {
    ...record,
    pricing: structuredClone(record.pricing),
    quotedAt: new Date(record.quotedAt),
    expiresAt: new Date(record.expiresAt),
  }
}

function cloneHold(record: BookingHoldInternalRecord): BookingHoldInternalRecord {
  return {
    ...record,
    target: { ...record.target },
    expiresAt: new Date(record.expiresAt),
    createdAt: new Date(record.createdAt),
  }
}

function cloneCommit(record: BookingCommitInternalRecord): BookingCommitInternalRecord {
  return {
    ...record,
    outcome: structuredClone(record.outcome),
    createdAt: new Date(record.createdAt),
  }
}
