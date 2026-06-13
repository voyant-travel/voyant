import { describe, expect, it } from "vitest"

import { createAdminCoreExtension as createAdminCoreExtensionShim } from "../src/core-extension/index.js"
import { adminRootHead as adminRootHeadShim } from "../src/root.js"
import { createAdminQueryClient as createAdminQueryClientShim } from "../src/router.js"
import { createAdminWorkspaceBeforeLoad as createAdminWorkspaceBeforeLoadShim } from "../src/workspace.js"

describe("@voyantjs/admin-app compatibility exports", () => {
  it("re-exports the admin app shell surface", async () => {
    const { createAdminCoreExtension } = await import("@voyantjs/admin/app/core-extension")
    const { adminRootHead } = await import("@voyantjs/admin/app/root")
    const { createAdminQueryClient } = await import("@voyantjs/admin/app/router")
    const { createAdminWorkspaceBeforeLoad } = await import("@voyantjs/admin/app/workspace")

    expect(createAdminCoreExtensionShim).toBe(createAdminCoreExtension)
    expect(adminRootHeadShim).toBe(adminRootHead)
    expect(createAdminQueryClientShim).toBe(createAdminQueryClient)
    expect(createAdminWorkspaceBeforeLoadShim).toBe(createAdminWorkspaceBeforeLoad)
  })
})
