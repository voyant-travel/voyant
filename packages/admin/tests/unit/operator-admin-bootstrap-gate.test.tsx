import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { OperatorAdminBootstrapGate } from "../../src/components/operator-admin-bootstrap-gate.js"

afterEach(() => {
  cleanup()
})

describe("OperatorAdminBootstrapGate", () => {
  it("renders single-tenant shell content from user readiness only", () => {
    render(
      <OperatorAdminBootstrapGate
        user={{ id: "user_1" }}
        workspace={null}
        isWorkspaceLoading={true}
        loadingFallback={<span>Loading workspace</span>}
      >
        <span>Dashboard</span>
      </OperatorAdminBootstrapGate>,
    )

    expect(screen.getByText("Dashboard")).not.toBeNull()
    expect(screen.queryByText("Loading workspace")).toBeNull()
  })

  it("renders the loading fallback while current user is loading", () => {
    render(
      <OperatorAdminBootstrapGate user={null} isUserLoading loadingFallback={<span>Loading</span>}>
        <span>Dashboard</span>
      </OperatorAdminBootstrapGate>,
    )

    expect(screen.getByText("Loading")).not.toBeNull()
    expect(screen.queryByText("Dashboard")).toBeNull()
  })

  it("requires workspace readiness only for explicit organization mode", () => {
    render(
      <OperatorAdminBootstrapGate
        mode="organization"
        user={{ id: "user_1" }}
        workspace={null}
        missingWorkspaceFallback={<span>Select workspace</span>}
      >
        <span>Dashboard</span>
      </OperatorAdminBootstrapGate>,
    )

    expect(screen.getByText("Select workspace")).not.toBeNull()
    expect(screen.queryByText("Dashboard")).toBeNull()
  })

  it("passes user and workspace into render-prop children", () => {
    render(
      <OperatorAdminBootstrapGate
        mode="organization"
        user={{ id: "user_1" }}
        workspace={{ id: "org_1" }}
      >
        {({ user, workspace, mode }) => (
          <span>
            {user.id}:{workspace?.id}:{mode}
          </span>
        )}
      </OperatorAdminBootstrapGate>,
    )

    expect(screen.getByText("user_1:org_1:organization")).not.toBeNull()
  })
})
