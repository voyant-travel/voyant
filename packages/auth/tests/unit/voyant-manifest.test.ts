import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

import { identityAccessRuntimePort } from "../../src/identity-access-runtime-port.js"
import {
  createInvitationsAdminRoutes,
  createInvitationsPublicRoutes,
} from "../../src/invitations-routes.js"
import { createTeamAdminRoutes } from "../../src/team-routes.js"
import { authInvitationsVoyantModule, authTeamVoyantModule } from "../../src/voyant.js"

describe("auth identity/access deployment manifests", () => {
  it("owns invitations and team route bundles behind one typed deployment port", () => {
    expect(authInvitationsVoyantModule).toMatchObject({
      id: "@voyant-travel/auth#invitations",
      packageName: "@voyant-travel/auth",
      runtimePorts: [{ id: identityAccessRuntimePort.id }],
      api: [
        {
          surface: "admin",
          mount: "invitations",
          resource: "team",
          openapi: { document: "invitations" },
          transactional: true,
        },
        {
          surface: "public",
          mount: "invitations",
          anonymous: true,
          openapi: { document: "invitations" },
          transactional: true,
        },
      ],
    })
    expect(authTeamVoyantModule).toMatchObject({
      id: "@voyant-travel/auth#team",
      packageName: "@voyant-travel/auth",
      runtimePorts: [{ id: identityAccessRuntimePort.id }],
      api: [{ surface: "admin", mount: "team", openapi: { document: "team" } }],
    })
  })

  it("claims every package-owned invitations and team OpenAPI operation", async () => {
    const documents = await Promise.all([
      readOpenApi("../../openapi/admin/invitations.json"),
      readOpenApi("../../openapi/storefront/invitations.json"),
      readOpenApi("../../openapi/admin/team.json"),
    ])

    const runtime = {} as Parameters<typeof createInvitationsAdminRoutes>[0]
    expect(operationClaims(documents[0])).toEqual(
      liveOperationClaims(createInvitationsAdminRoutes(runtime), "/v1/admin/invitations"),
    )
    expect(operationClaims(documents[1])).toEqual(
      liveOperationClaims(createInvitationsPublicRoutes(), "/v1/public/invitations"),
    )
    expect(operationClaims(documents[2])).toEqual(
      liveOperationClaims(createTeamAdminRoutes(runtime), "/v1/admin/team"),
    )
  })
})

type OpenApiDocument = {
  paths?: Record<string, Record<string, Record<string, unknown>>>
}

async function readOpenApi(relativePath: string): Promise<OpenApiDocument> {
  return JSON.parse(await readFile(new URL(relativePath, import.meta.url), "utf8"))
}

function operationClaims(document: OpenApiDocument): string[][] {
  return Object.entries(document.paths ?? {})
    .flatMap(([path, pathItem]) =>
      Object.entries(pathItem).map(([method, operation]) => [
        method.toUpperCase(),
        path,
        String(operation["x-voyant-api-id"]),
      ]),
    )
    .sort((left, right) => left.join(":").localeCompare(right.join(":")))
}

function liveOperationClaims(
  app: { getOpenAPI31Document(input: Record<string, unknown>): OpenApiDocument },
  mount: string,
): string[][] {
  const document = app.getOpenAPI31Document({
    openapi: "3.1.0",
    info: { title: "test", version: "1.0.0" },
  })
  return operationClaims({
    paths: Object.fromEntries(
      Object.entries(document.paths ?? {}).map(([path, item]) => [
        `${mount}${path === "/" ? "" : path}`,
        item,
      ]),
    ),
  })
}
