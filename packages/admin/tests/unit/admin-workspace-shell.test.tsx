import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { AdminWorkspaceShell } from "../../src/app/workspace.js"

describe("AdminWorkspaceShell", () => {
  it("renders its bootstrap state without a host-owned messages provider", () => {
    render(
      <AdminWorkspaceShell user={null} isUserLoading extensions={[]}>
        <span>workspace</span>
      </AdminWorkspaceShell>,
    )

    expect(screen.queryByText("workspace")).toBeNull()
    expect(document.querySelector("svg.animate-spin")).not.toBeNull()
  })
})
