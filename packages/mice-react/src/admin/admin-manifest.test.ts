import { describe, expect, it } from "vitest"

import { miceVoyantModule } from "../../../mice/src/voyant.js"
import { createMiceAdminExtension } from "./index.js"

describe("MICE admin deployment facets", () => {
  it("tracks the package-owned extension routes", () => {
    const extension = createMiceAdminExtension()
    expect(miceVoyantModule.admin?.runtime).toEqual({
      entry: "@voyant-travel/mice-react/admin",
      export: "createMiceAdminExtension",
    })
    expect(miceVoyantModule.admin?.routes?.map((route) => route.path)).toEqual(
      extension.routes?.map((route) => route.path),
    )
    expect(extension.routes?.map((route) => route.destination)).toEqual([
      "mice.program.list",
      "mice.program.detail",
    ])
    expect(miceVoyantModule.admin?.routes?.map((route) => route.runtime)).toEqual(
      extension.routes?.map(() => ({
        entry: "@voyant-travel/mice-react/admin",
        export: "createMiceAdminExtension",
      })),
    )
  })
})
