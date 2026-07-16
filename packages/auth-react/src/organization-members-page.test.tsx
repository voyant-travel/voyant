// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { LocaleProvider, OperatorAdminMessagesProvider } from "@voyant-travel/admin"
import { act, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  OrganizationMembersPage,
  OrganizationMembersPageSkeleton,
} from "./components/organization-members-page.js"
import {
  authQueryKeys,
  type OrganizationInvitation,
  type OrganizationMember,
  VoyantAuthProvider,
  type VoyantFetcher,
} from "./index.js"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

const members: OrganizationMember[] = [
  {
    id: "member_1",
    userId: "user_1",
    organizationId: "org_1",
    role: "owner",
    createdAt: "2026-05-12T12:00:00.000Z",
    user: {
      id: "user_1",
      email: "ana@example.com",
      name: "Ana Popescu",
      image: null,
    },
  },
  {
    id: "member_2",
    userId: "user_2",
    organizationId: "org_1",
    role: "member",
    createdAt: "2026-05-13T12:00:00.000Z",
    user: {
      id: "user_2",
      email: "maria@example.com",
      name: "Maria Ionescu",
      image: null,
    },
  },
]

const invitations: OrganizationInvitation[] = [
  {
    id: "invitation_1",
    organizationId: "org_1",
    email: "pending@example.com",
    role: "admin",
    status: "pending",
    inviterId: "user_1",
    expiresAt: "2026-05-20T12:00:00.000Z",
    createdAt: "2026-05-13T12:00:00.000Z",
  },
  {
    id: "invitation_2",
    organizationId: "org_1",
    email: "accepted@example.com",
    role: "member",
    status: "accepted",
    inviterId: "user_1",
    expiresAt: "2026-05-20T12:00:00.000Z",
    createdAt: "2026-05-13T12:00:00.000Z",
  },
]

function makeQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  })
  queryClient.setQueryData(authQueryKeys.organizationMembers({ organizationId: "org_1" }), {
    members,
  })
  queryClient.setQueryData(authQueryKeys.organizationInvitations({ organizationId: "org_1" }), [
    ...invitations,
  ])
  return queryClient
}

function renderWithProviders(element: ReactNode, fetcher: VoyantFetcher = asyncFetcher()) {
  return renderToStaticMarkup(
    <LocaleProvider localeStorageKey={null} timeZoneStorageKey={null}>
      <OperatorAdminMessagesProvider>
        <QueryClientProvider client={makeQueryClient()}>
          <VoyantAuthProvider baseUrl="https://operator.example/api" fetcher={fetcher}>
            {element}
          </VoyantAuthProvider>
        </QueryClientProvider>
      </OperatorAdminMessagesProvider>
    </LocaleProvider>,
  )
}

function asyncFetcher(): VoyantFetcher {
  return async () => new Response(null, { status: 204 })
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  })
}

function bodyAsJson(init: RequestInit | undefined) {
  return init?.body ? JSON.parse(String(init.body)) : null
}

async function renderClient(element: ReactNode, fetcher: VoyantFetcher) {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(
      <LocaleProvider localeStorageKey={null} timeZoneStorageKey={null}>
        <OperatorAdminMessagesProvider>
          <QueryClientProvider client={makeQueryClient()}>
            <VoyantAuthProvider baseUrl="https://operator.example/api" fetcher={fetcher}>
              {element}
            </VoyantAuthProvider>
          </QueryClientProvider>
        </OperatorAdminMessagesProvider>
      </LocaleProvider>,
    )
  })

  return { container, root }
}

async function changeInput(input: HTMLInputElement | HTMLSelectElement, value: string) {
  const prototype =
    input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
  const valueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set
  valueSetter?.call(input, value)

  await act(async () => {
    input.dispatchEvent(new Event("input", { bubbles: true }))
    input.dispatchEvent(new Event("change", { bubbles: true }))
  })
}

async function submit(form: HTMLFormElement) {
  await act(async () => {
    form.dispatchEvent(
      new SubmitEvent("submit", {
        bubbles: true,
        cancelable: true,
      }),
    )
  })
}

function changeInputSync(input: HTMLInputElement | HTMLSelectElement, value: string) {
  const prototype =
    input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
  const valueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set
  valueSetter?.call(input, value)
  input.dispatchEvent(new Event("input", { bubbles: true }))
  input.dispatchEvent(new Event("change", { bubbles: true }))
}

async function click(element: Element) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }))
  })
}

let mountedRoot: Root | null = null

afterEach(() => {
  mountedRoot?.unmount()
  mountedRoot = null
  document.body.innerHTML = ""
  vi.restoreAllMocks()
})

describe("OrganizationMembersPage", () => {
  it("renders members, role controls, and pending invitations", () => {
    const markup = renderWithProviders(
      <OrganizationMembersPage organizationId="org_1" showSidebarTrigger={false} />,
    )

    expect(markup).toContain("Organization members")
    expect(markup).toContain("Ana Popescu")
    expect(markup).toContain("maria@example.com")
    expect(markup).toContain("pending@example.com")
    expect(markup).not.toContain("accepted@example.com")
    expect(markup).toContain("organization-member-invite-email")
    expect(markup).toContain("Update role for Maria Ionescu")
  })

  it("renders empty and skeleton states", () => {
    const emptyQueryClient = new QueryClient()
    emptyQueryClient.setQueryData(authQueryKeys.organizationMembers({ organizationId: "org_1" }), {
      members: [],
    })
    emptyQueryClient.setQueryData(
      authQueryKeys.organizationInvitations({ organizationId: "org_1" }),
      [],
    )

    const emptyMarkup = renderToStaticMarkup(
      <LocaleProvider localeStorageKey={null} timeZoneStorageKey={null}>
        <OperatorAdminMessagesProvider>
          <QueryClientProvider client={emptyQueryClient}>
            <VoyantAuthProvider baseUrl="https://operator.example/api" fetcher={asyncFetcher()}>
              <OrganizationMembersPage organizationId="org_1" showSidebarTrigger={false} />
            </VoyantAuthProvider>
          </QueryClientProvider>
        </OperatorAdminMessagesProvider>
      </LocaleProvider>,
    )
    const skeletonMarkup = renderToStaticMarkup(<OrganizationMembersPageSkeleton />)

    expect(emptyMarkup).toContain("No members were found")
    expect(emptyMarkup).toContain("No pending invitations")
    expect(skeletonMarkup).toContain("organization-members-page-skeleton")
  })

  it("posts invite, role update, resend, cancel, and remove mutations through auth hooks", async () => {
    const requests: Array<{ body: unknown; path: string }> = []
    const fetcher: VoyantFetcher = async (url, init) => {
      const path = new URL(url).pathname
      requests.push({ path, body: bodyAsJson(init) })

      if (path.endsWith("/auth/organization/invite-member")) {
        return jsonResponse({
          ...invitations[0],
          email: (bodyAsJson(init) as { email: string }).email,
          role: (bodyAsJson(init) as { role: string }).role,
        })
      }

      if (path.endsWith("/auth/organization/update-member-role")) {
        return jsonResponse({
          ...members[1],
          role: (bodyAsJson(init) as { role: string }).role,
        })
      }

      if (path.endsWith("/auth/organization/remove-member")) {
        return jsonResponse({ success: true, member: null })
      }

      if (path.endsWith("/auth/organization/cancel-invitation")) {
        return jsonResponse(null)
      }

      if (path.endsWith("/auth/organization/list-members")) {
        return jsonResponse({ members })
      }

      if (path.endsWith("/auth/organization/list-invitations")) {
        return jsonResponse(invitations)
      }

      return new Response(null, { status: 204 })
    }

    vi.spyOn(window, "confirm").mockReturnValue(true)

    const rendered = await renderClient(
      <OrganizationMembersPage organizationId="org_1" showSidebarTrigger={false} />,
      fetcher,
    )
    mountedRoot = rendered.root

    const email = rendered.container.querySelector<HTMLInputElement>(
      "#organization-member-invite-email",
    )
    expect(email).not.toBeNull()
    await changeInput(email as HTMLInputElement, "new@example.com")
    await submit(rendered.container.querySelector("form") as HTMLFormElement)

    const mariaRole = rendered.container.querySelector<HTMLSelectElement>(
      'select[aria-label="Update role for Maria Ionescu"]',
    )
    expect(mariaRole).not.toBeNull()
    await act(async () => {
      changeInputSync(mariaRole as HTMLSelectElement, "admin")
    })

    await click(
      rendered.container.querySelector(
        'button[aria-label="Resend invitation to pending@example.com"]',
      ) as HTMLButtonElement,
    )
    await click(
      rendered.container.querySelector(
        'button[aria-label="Cancel invitation to pending@example.com"]',
      ) as HTMLButtonElement,
    )
    await click(
      rendered.container.querySelector(
        'button[aria-label="Remove Maria Ionescu"]',
      ) as HTMLButtonElement,
    )

    expect(requests).toEqual(
      expect.arrayContaining([
        {
          path: "/api/auth/organization/invite-member",
          body: { email: "new@example.com", organizationId: "org_1", role: "member" },
        },
        {
          path: "/api/auth/organization/update-member-role",
          body: { memberId: "member_2", organizationId: "org_1", role: "admin" },
        },
        {
          path: "/api/auth/organization/invite-member",
          body: {
            email: "pending@example.com",
            organizationId: "org_1",
            resend: true,
            role: "admin",
          },
        },
        {
          path: "/api/auth/organization/cancel-invitation",
          body: { invitationId: "invitation_1" },
        },
        {
          path: "/api/auth/organization/remove-member",
          body: { memberIdOrEmail: "maria@example.com", organizationId: "org_1" },
        },
      ]),
    )
  })
})
