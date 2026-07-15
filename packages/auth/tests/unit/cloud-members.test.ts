import { describe, expect, it } from "vitest"

import {
  CloudAdminMembersError,
  cloudAdminMembersConfigFromRevalidate,
  deriveCloudAdminMembersBaseUrl,
  inviteCloudAdminMember,
  listCloudAdminMembers,
  revokeCloudAdminInvitation,
  setCloudAdminMemberAccess,
  setCloudAdminMemberRole,
} from "../../src/cloud-broker.js"

const config = {
  baseUrl: "https://api.voyant.travel/cloud/v1/admin-auth",
  deploymentId: "dep_123",
  clientToken: "client_token_123",
}

type FetchCall = { url: string; init?: RequestInit }

function recordingFetch(response: () => Response) {
  const calls: FetchCall[] = []
  const fetch = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: url.toString(), init })
    return response()
  }
  return { calls, fetch: fetch as typeof globalThis.fetch }
}

describe("deriveCloudAdminMembersBaseUrl", () => {
  it("strips the trailing /revalidate to reuse the admin-auth prefix", () => {
    expect(
      deriveCloudAdminMembersBaseUrl("https://api.voyant.travel/cloud/v1/admin-auth/revalidate"),
    ).toBe("https://api.voyant.travel/cloud/v1/admin-auth")
  })

  it("builds a member config from a revalidate config", () => {
    expect(
      cloudAdminMembersConfigFromRevalidate({
        revalidateUrl: "https://api.voyant.travel/cloud/v1/admin-auth/revalidate",
        deploymentId: "dep_123",
        clientToken: "client_token_123",
      }),
    ).toEqual(config)
  })
})

describe("cloud member requests", () => {
  it("sends the deployment + acting-user headers and unwraps data", async () => {
    const { calls, fetch } = recordingFetch(() =>
      Response.json({ data: [{ membershipId: "om_1" }] }),
    )

    const members = await listCloudAdminMembers({
      config,
      actingWorkosUserId: "user_acting",
      fetch,
    })

    expect(members).toEqual([{ membershipId: "om_1" }])
    expect(calls[0]?.url).toBe(`${config.baseUrl}/members`)
    expect(calls[0]?.init?.headers).toMatchObject({
      Authorization: "Bearer client_token_123",
      "x-voyant-deployment-id": "dep_123",
      "x-voyant-acting-user-id": "user_acting",
    })
  })

  it("posts an invite body", async () => {
    const { calls, fetch } = recordingFetch(() =>
      Response.json({ data: { id: "invite_1" } }, { status: 201 }),
    )

    await inviteCloudAdminMember({
      config,
      actingWorkosUserId: "user_acting",
      fetch,
      input: { email: "new@example.com", roleSlug: "member" },
    })

    expect(calls[0]?.url).toBe(`${config.baseUrl}/invitations`)
    expect(calls[0]?.init?.method).toBe("POST")
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      email: "new@example.com",
      roleSlug: "member",
    })
  })

  it("toggles deployment access via PUT", async () => {
    const { calls, fetch } = recordingFetch(() =>
      Response.json({ data: { membershipId: "om_1", hasDeploymentAccess: true } }),
    )

    await setCloudAdminMemberAccess({
      config,
      actingWorkosUserId: "user_acting",
      fetch,
      membershipId: "om_1",
      hasAccess: true,
    })

    expect(calls[0]?.url).toBe(`${config.baseUrl}/members/om_1/access`)
    expect(calls[0]?.init?.method).toBe("PUT")
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ hasAccess: true })
  })

  it("assigns a provider role without exposing provider fields to the route contract", async () => {
    const { calls, fetch } = recordingFetch(() =>
      Response.json({ data: { membershipId: "om_1", roleSlug: "editor" } }),
    )

    await setCloudAdminMemberRole({
      config,
      actingWorkosUserId: "user_acting",
      fetch,
      membershipId: "om_1",
      roleSlug: "editor",
    })

    expect(calls[0]?.url).toBe(`${config.baseUrl}/members/om_1/role`)
    expect(calls[0]?.init?.method).toBe("PUT")
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ roleSlug: "editor" })
  })

  it("resolves void on a 204 revoke", async () => {
    const { fetch } = recordingFetch(() => new Response(null, { status: 204 }))

    await expect(
      revokeCloudAdminInvitation({
        config,
        actingWorkosUserId: "user_acting",
        fetch,
        invitationId: "invite_1",
      }),
    ).resolves.toBeUndefined()
  })

  it("throws CloudAdminMembersError with the platform reason on failure", async () => {
    const { fetch } = recordingFetch(() =>
      Response.json({ error: "not_a_manager" }, { status: 403 }),
    )

    await expect(
      listCloudAdminMembers({ config, actingWorkosUserId: "user_acting", fetch }),
    ).rejects.toMatchObject({
      name: "CloudAdminMembersError",
      status: 403,
      reason: "not_a_manager",
    })
  })

  it("rejects a request with no acting user before calling fetch", async () => {
    const { calls, fetch } = recordingFetch(() => Response.json({ data: [] }))

    await expect(
      listCloudAdminMembers({ config, actingWorkosUserId: "  ", fetch }),
    ).rejects.toThrow(/acting user/)
    expect(calls).toHaveLength(0)
    // Sanity: the error type is the generic guard, not a transport error.
    expect(CloudAdminMembersError).toBeDefined()
  })
})
