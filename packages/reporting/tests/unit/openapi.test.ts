import { describe, expect, it } from "vitest"
import reportingOpenApi from "../../openapi/admin/reporting.json"

describe("reporting OpenAPI artifact", () => {
  it("documents every mounted reporting route and result authorization", () => {
    expect(Object.keys(reportingOpenApi.paths)).toEqual(
      expect.arrayContaining([
        "/v1/admin/reporting/catalog",
        "/v1/admin/reporting/queries/parse",
        "/v1/admin/reporting/queries/preview",
        "/v1/admin/reporting/reports",
        "/v1/admin/reporting/reports/{id}",
        "/v1/admin/reporting/reports/{id}/export",
        "/v1/admin/reporting/templates/{id}/instantiate",
      ]),
    )
    expect(
      reportingOpenApi.paths["/v1/admin/reporting/reports/{id}/export"].get.description,
    ).toContain("reports:export")
    expect(
      reportingOpenApi.paths["/v1/admin/reporting/queries/parse"].post.requestBody,
    ).toMatchObject({ required: true })
    expect(
      reportingOpenApi.paths["/v1/admin/reporting/reports/{id}"].patch.requestBody,
    ).toMatchObject({ required: true })
  })
})
