import { describe, expect, it } from "vitest"
import {
  APP_SESSION_TOKEN_PREFIX,
  type AppSessionTokenContext,
  signAppSessionToken,
  verifyAppSessionToken,
} from "./session-token.js"

const secret = "test-deployment-session-secret-value-000000000000"
const context: AppSessionTokenContext = {
  appId: "app_1",
  installationId: "apin_1",
  deploymentId: "dep_1",
  viewerId: "usr_1",
  viewerScopes: ["finance-documents:read", "finance-document-artifacts:write"],
  entity: { type: "booking", id: "book_1" },
  slot: "booking.details.header",
}

const managedContext: AppSessionTokenContext = {
  ...context,
  workloadEnvironmentId: "workload_environment_1",
  contractGeneration: 3,
}

const at = (iso: string) => () => new Date(iso)

describe("app session token", () => {
  it("round-trips claims, binds context, and carries a unique id", () => {
    const signed = signAppSessionToken(context, secret, { now: at("2026-07-17T10:00:00Z") })
    expect(signed.token.startsWith(APP_SESSION_TOKEN_PREFIX)).toBe(true)

    const result = verifyAppSessionToken(signed.token, secret, {
      audience: "app_1",
      deploymentId: "dep_1",
      now: at("2026-07-17T10:01:00Z"),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.claims.aud).toBe("app_1")
    expect(result.claims.sub).toBe("usr_1")
    expect(result.claims.installationId).toBe("apin_1")
    expect(result.claims.entity).toEqual({ type: "booking", id: "book_1" })
    expect(result.claims.slot).toBe("booking.details.header")
    expect(result.claims.viewerScopes).toEqual([
      "finance-document-artifacts:write",
      "finance-documents:read",
    ])
    expect(result.claims.jti).toMatch(/^st_/)
  })

  it("mints a distinct jti per issuance", () => {
    const a = signAppSessionToken(context, secret, { now: at("2026-07-17T10:00:00Z") })
    const b = signAppSessionToken(context, secret, { now: at("2026-07-17T10:00:00Z") })
    expect(a.claims.jti).not.toBe(b.claims.jti)
  })

  it("rejects a token past its short expiry", () => {
    const signed = signAppSessionToken(context, secret, {
      now: at("2026-07-17T10:00:00Z"),
      ttlSeconds: 120,
    })
    const result = verifyAppSessionToken(signed.token, secret, {
      now: at("2026-07-17T10:03:00Z"),
    })
    expect(result).toEqual({ ok: false, reason: "expired" })
  })

  it("fails closed on audience mismatch (confused deputy)", () => {
    const signed = signAppSessionToken(context, secret, { now: at("2026-07-17T10:00:00Z") })
    const result = verifyAppSessionToken(signed.token, secret, {
      audience: "app_other",
      now: at("2026-07-17T10:01:00Z"),
    })
    expect(result).toEqual({ ok: false, reason: "audience_mismatch" })
  })

  it("fails closed on deployment mismatch", () => {
    const signed = signAppSessionToken(context, secret, { now: at("2026-07-17T10:00:00Z") })
    const result = verifyAppSessionToken(signed.token, secret, {
      deploymentId: "dep_other",
      now: at("2026-07-17T10:01:00Z"),
    })
    expect(result).toEqual({ ok: false, reason: "deployment_mismatch" })
  })

  it("uses the stable workload environment rather than deployment revision in managed mode", () => {
    const signed = signAppSessionToken(
      { ...managedContext, deploymentId: "deployment_revision_1" },
      secret,
      { now: at("2026-07-17T10:00:00Z") },
    )
    const result = verifyAppSessionToken(signed.token, secret, {
      audience: "app_1",
      workloadEnvironmentId: "workload_environment_1",
      contractGeneration: 3,
      now: at("2026-07-17T10:01:00Z"),
    })
    expect(result.ok).toBe(true)
  })

  it("fails closed across managed workload environments and stale contract generations", () => {
    const signed = signAppSessionToken(managedContext, secret, {
      now: at("2026-07-17T10:00:00Z"),
    })
    expect(
      verifyAppSessionToken(signed.token, secret, {
        workloadEnvironmentId: "workload_environment_other",
        contractGeneration: 3,
        now: at("2026-07-17T10:01:00Z"),
      }),
    ).toEqual({ ok: false, reason: "workload_environment_mismatch" })
    expect(
      verifyAppSessionToken(signed.token, secret, {
        workloadEnvironmentId: "workload_environment_1",
        contractGeneration: 4,
        now: at("2026-07-17T10:01:00Z"),
      }),
    ).toEqual({ ok: false, reason: "contract_generation_mismatch" })
  })

  it("supports independent app contract generations in one workload environment", () => {
    const first = signAppSessionToken(
      { ...managedContext, appId: "app_1", contractGeneration: 2 },
      secret,
      { now: at("2026-07-17T10:00:00Z") },
    )
    const second = signAppSessionToken(
      { ...managedContext, appId: "app_2", contractGeneration: 9 },
      secret,
      { now: at("2026-07-17T10:00:00Z") },
    )
    expect(
      verifyAppSessionToken(first.token, secret, {
        audience: "app_1",
        workloadEnvironmentId: "workload_environment_1",
        contractGeneration: 2,
        now: at("2026-07-17T10:01:00Z"),
      }).ok,
    ).toBe(true)
    expect(
      verifyAppSessionToken(second.token, secret, {
        audience: "app_2",
        workloadEnvironmentId: "workload_environment_1",
        contractGeneration: 9,
        now: at("2026-07-17T10:01:00Z"),
      }).ok,
    ).toBe(true)
  })

  it("rejects a tampered signature", () => {
    const signed = signAppSessionToken(context, secret, { now: at("2026-07-17T10:00:00Z") })
    const tampered = `${signed.token.slice(0, -2)}xy`
    const result = verifyAppSessionToken(tampered, secret, { now: at("2026-07-17T10:01:00Z") })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(["bad_signature", "malformed"]).toContain(result.reason)
  })

  it("rejects a token signed with a different secret (context-separated key)", () => {
    const signed = signAppSessionToken(context, secret, { now: at("2026-07-17T10:00:00Z") })
    const result = verifyAppSessionToken(signed.token, `${secret}-rotated`, {
      now: at("2026-07-17T10:01:00Z"),
    })
    expect(result).toEqual({ ok: false, reason: "bad_signature" })
  })

  it("rejects a non-session-token string", () => {
    expect(verifyAppSessionToken("nope", secret)).toEqual({ ok: false, reason: "malformed" })
    expect(verifyAppSessionToken("vsess_only.two", secret)).toEqual({
      ok: false,
      reason: "malformed",
    })
  })

  it("normalizes a list-surface (no entity) context", () => {
    const signed = signAppSessionToken({ ...context, entity: null, slot: null }, secret, {
      now: at("2026-07-17T10:00:00Z"),
    })
    const result = verifyAppSessionToken(signed.token, secret, { now: at("2026-07-17T10:01:00Z") })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.claims.entity).toBeNull()
    expect(result.claims.slot).toBeNull()
  })
})
