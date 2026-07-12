import { describe, expect, it } from "vitest"

import { identityAccessRuntimePort } from "../../src/identity-access-runtime-port.js"
import { authInvitationsVoyantModule, authTeamVoyantModule } from "../../src/voyant.js"

describe("auth identity/access deployment manifests", () => {
  it("owns invitations and team route bundles behind one typed deployment port", () => {
    expect(authInvitationsVoyantModule).toMatchObject({
      id: "@voyant-travel/auth#invitations",
      packageName: "@voyant-travel/auth",
      runtimePorts: [{ id: identityAccessRuntimePort.id }],
      api: [
        { surface: "admin", mount: "invitations", transactional: true },
        { surface: "public", mount: "invitations", anonymous: true, transactional: true },
      ],
    })
    expect(authTeamVoyantModule).toMatchObject({
      id: "@voyant-travel/auth#team",
      packageName: "@voyant-travel/auth",
      runtimePorts: [{ id: identityAccessRuntimePort.id }],
      api: [{ surface: "admin", mount: "team" }],
    })
  })
})
