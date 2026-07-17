import { describe, expect, it } from "vitest"
import { canInstallOver, planLifecycleTransition } from "./installation-state.js"

describe("app installation lifecycle state", () => {
  it("treats repeated pause, resume, and uninstall actions as idempotent", () => {
    expect(planLifecycleTransition("paused", ["active", "degraded"], "paused", "pause")).toEqual({
      outcome: "unchanged",
      status: "paused",
    })
    expect(planLifecycleTransition("active", ["paused"], "active", "resume")).toEqual({
      outcome: "unchanged",
      status: "active",
    })
    expect(
      planLifecycleTransition(
        "uninstalled",
        ["active", "paused", "degraded"],
        "uninstalled",
        "uninstall",
      ),
    ).toEqual({ outcome: "unchanged", status: "uninstalled" })
  })

  it("allows the expected active, paused, resumed, and uninstalled path", () => {
    expect(planLifecycleTransition("active", ["active", "degraded"], "paused", "pause")).toEqual({
      outcome: "updated",
      from: "active",
      to: "paused",
    })
    expect(planLifecycleTransition("paused", ["paused"], "active", "resume")).toEqual({
      outcome: "updated",
      from: "paused",
      to: "active",
    })
    expect(
      planLifecycleTransition(
        "active",
        ["active", "paused", "degraded"],
        "uninstalled",
        "uninstall",
      ),
    ).toEqual({ outcome: "updated", from: "active", to: "uninstalled" })
  })

  it("rejects invalid lifecycle transitions", () => {
    expect(() =>
      planLifecycleTransition("pending", ["active", "degraded"], "paused", "pause"),
    ).toThrow("Cannot pause app installation from pending")
    expect(() => planLifecycleTransition("revoked", ["paused"], "active", "resume")).toThrow(
      "Cannot resume app installation from revoked",
    )
  })

  it("only reinstalls over terminal retained rows", () => {
    expect(canInstallOver("uninstalled")).toBe(true)
    expect(canInstallOver("revoked")).toBe(true)
    expect(canInstallOver("active")).toBe(false)
    expect(canInstallOver("paused")).toBe(false)
  })
})
