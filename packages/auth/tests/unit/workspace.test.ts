import { describe, expect, it, vi } from "vitest"

import {
  isFirstAuthUser,
  provisionCurrentUserProfile,
  updateCurrentUserProfile,
} from "../../src/workspace.js"

describe("updateCurrentUserProfile", () => {
  it("maps explicit locale resets to the default locale", async () => {
    const onConflictDoUpdate = vi.fn(async () => undefined)
    const values = vi.fn(() => ({ onConflictDoUpdate }))
    const limit = vi.fn(async () => [
      {
        id: "user_123",
        email: "ana@example.com",
        phoneNumber: null,
        firstName: null,
        lastName: null,
        locale: "en",
        timezone: null,
        avatarUrl: null,
        isSuperAdmin: false,
        isSupportUser: false,
        createdAt: new Date("2026-05-12T00:00:00.000Z"),
      },
    ])
    const db = {
      insert: vi.fn(() => ({ values })),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          leftJoin: vi.fn(() => ({
            where: vi.fn(() => ({ limit })),
          })),
        })),
      })),
    }

    const profile = await updateCurrentUserProfile(db as never, {
      userId: "user_123",
      locale: null,
    })

    expect(values).toHaveBeenCalledWith(expect.objectContaining({ id: "user_123", locale: "en" }))
    expect(onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        set: expect.objectContaining({ locale: "en" }),
      }),
    )
    expect(profile?.locale).toBe("en")
  })
})

describe("provisionCurrentUserProfile", () => {
  it("splits display names and preserves bootstrap super-admin state", async () => {
    const onConflictDoNothing = vi.fn(async () => undefined)
    const values = vi.fn(() => ({ onConflictDoNothing }))
    const db = {
      insert: vi.fn(() => ({ values })),
    }

    await provisionCurrentUserProfile(db as never, {
      userId: "user_123",
      name: "Ana Maria Pop",
      image: "https://example.com/avatar.png",
      isSuperAdmin: true,
    })

    expect(values).toHaveBeenCalledWith({
      id: "user_123",
      firstName: "Ana",
      lastName: "Maria Pop",
      avatarUrl: "https://example.com/avatar.png",
      isSuperAdmin: true,
    })
    expect(onConflictDoNothing).toHaveBeenCalled()
  })
})

describe("isFirstAuthUser", () => {
  it("returns true only when exactly one auth user exists", async () => {
    const from = vi.fn(async () => [{ count: 1 }])
    const db = {
      select: vi.fn(() => ({ from })),
    }

    await expect(isFirstAuthUser(db as never)).resolves.toBe(true)
  })
})
