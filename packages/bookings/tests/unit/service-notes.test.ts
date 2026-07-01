import { describe, expect, it, vi } from "vitest"

import { bookingActivityLog, bookingNotes, bookings } from "../../src/schema.js"
import { bookingsService } from "../../src/service.js"

function makeDb() {
  const activityRows: Array<Record<string, unknown>> = []
  const bookingTouches: Array<Record<string, unknown>> = []

  const db = {
    update: vi.fn((table) => ({
      set: vi.fn((values: Record<string, unknown>) => ({
        where: vi.fn(() => {
          if (table === bookingNotes) {
            return {
              returning: vi.fn(async () => [
                {
                  id: "note_123",
                  bookingId: "book_123",
                  authorId: "author_123",
                  content: values.content,
                  createdAt: new Date("2026-07-01T10:00:00.000Z"),
                },
              ]),
            }
          }

          if (table === bookings) {
            bookingTouches.push(values)
          }

          return Promise.resolve()
        }),
      })),
    })),
    delete: vi.fn((table) => ({
      where: vi.fn(() => ({
        returning: vi.fn(async () => {
          if (table === bookingNotes) {
            return [{ id: "note_123", authorId: "author_123" }]
          }
          return []
        }),
      })),
    })),
    insert: vi.fn((table) => ({
      values: vi.fn((values: Record<string, unknown>) => {
        if (table === bookingActivityLog) {
          activityRows.push(values)
        }
        return Promise.resolve(values)
      }),
    })),
  }

  return { db: db as never, activityRows, bookingTouches }
}

describe("bookingsService note activity", () => {
  it("records activity and touches the booking when a note is updated", async () => {
    const { db, activityRows, bookingTouches } = makeDb()

    const row = await bookingsService.updateNote(db, "book_123", "note_123", "user_123", {
      content: "Edited note",
    })

    expect(row?.content).toBe("Edited note")
    expect(activityRows).toEqual([
      expect.objectContaining({
        bookingId: "book_123",
        actorId: "user_123",
        activityType: "note_added",
        description: "Note updated",
        metadata: { noteId: "note_123" },
      }),
    ])
    expect(bookingTouches).toHaveLength(1)
    expect(bookingTouches[0]?.updatedAt).toBeInstanceOf(Date)
  })

  it("records activity and touches the booking when a note is deleted", async () => {
    const { db, activityRows, bookingTouches } = makeDb()

    const row = await bookingsService.deleteNote(db, "book_123", "note_123", "user_123")

    expect(row?.id).toBe("note_123")
    expect(activityRows).toEqual([
      expect.objectContaining({
        bookingId: "book_123",
        actorId: "user_123",
        activityType: "note_added",
        description: "Note deleted",
        metadata: { noteId: "note_123" },
      }),
    ])
    expect(bookingTouches).toHaveLength(1)
    expect(bookingTouches[0]?.updatedAt).toBeInstanceOf(Date)
  })
})
