import { describe, expect, it } from "vitest"

import { frameworkBundleDir, loadFrameworkBundleSource } from "./bundle.js"

describe("framework bundle", () => {
  it("loads the shipped bundle as the framework collector source", async () => {
    const source = await loadFrameworkBundleSource()
    expect(source.name).toBe("framework")
    // priority 0 — applies before deployment migrations (their links FK into
    // framework tables).
    expect(source.priority).toBe(0)
    expect(source.migrations.length).toBeGreaterThan(0)
    // The frozen baseline is first.
    expect(source.migrations[0]?.tag).toBe("0000_framework_baseline")
    expect(source.migrations[0]?.sql).toContain("CREATE TABLE")
  })

  it("ships the Cloud auth scopes migration", async () => {
    const source = await loadFrameworkBundleSource()
    const migration = source.migrations.find((entry) => entry.tag === "0008_framework_baseline")

    expect(migration?.sql.trim()).toBe(
      'ALTER TABLE "cloud_auth_user_links" ADD COLUMN IF NOT EXISTS "scopes" jsonb;',
    )
  })

  it("resolves a bundle dir ending in /migrations", () => {
    expect(frameworkBundleDir().endsWith("/migrations")).toBe(true)
  })
})
