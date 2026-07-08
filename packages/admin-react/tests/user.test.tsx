import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

import { UserProvider, useUser } from "../src/user.js"

type TestUser = { id: string; email: string }

function wrapper(getCurrentUser: () => Promise<TestUser | null>, initialUser?: TestUser | null) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <UserProvider<TestUser> getCurrentUser={getCurrentUser} initialUser={initialUser}>
          {children}
        </UserProvider>
      </QueryClientProvider>
    )
  }
}

describe("UserProvider / useUser", () => {
  it("exposes the fetched current user", async () => {
    const user: TestUser = { id: "usr_1", email: "staff@example.test" }
    const { result } = renderHook(() => useUser<TestUser>(), {
      wrapper: wrapper(vi.fn(async () => user)),
    })

    await waitFor(() => expect(result.current.user).toEqual(user))
    expect(result.current.isLoading).toBe(false)
  })

  it("hydrates from initialUser without a fetch", () => {
    const initial: TestUser = { id: "usr_2", email: "hydrated@example.test" }
    const getCurrentUser = vi.fn(async (): Promise<TestUser | null> => null)
    const { result } = renderHook(() => useUser<TestUser>(), {
      wrapper: wrapper(getCurrentUser, initial),
    })

    expect(result.current.user).toEqual(initial)
    expect(getCurrentUser).not.toHaveBeenCalled()
  })

  it("treats an undefined current user as signed out (not an error)", async () => {
    const getCurrentUser = vi.fn(async (): Promise<TestUser | null | undefined> => undefined)
    const { result } = renderHook(() => useUser<TestUser>(), {
      wrapper: wrapper(getCurrentUser as () => Promise<TestUser | null>),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.user).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it("throws when used outside a UserProvider", () => {
    expect(() => renderHook(() => useUser<TestUser>())).toThrow(
      /useUser must be used within UserProvider/,
    )
  })
})
