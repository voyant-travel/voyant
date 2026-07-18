import reportingOpenApi from "../../openapi/admin/reporting.json"
import { describe, expect, it } from "vitest"

describe("reporting OpenAPI artifact", () => {
  it("documents every mounted reporting route and result authorization", () => {
    expect(Object.keys(reportingOpenApi.paths)).toEqual(
      expect.arrayContaining([
        "/v1/admin/reporting/catalog",
        "/v1/admin/reporting/queries/parse",
        "/v1/admin/reporting/queries/preview",
        "/v1/admin/reporting/reports",
        "/v1/admin/reporting/reports/{id}",
        "/v1/admin/reporting/templates/{id}/instantiate",
        "/v1/admin/reporting/reports/{id}/versions",
        "/v1/admin/reporting/versions/{id}/runs",
        "/v1/admin/reporting/runs/{id}",
      ]),
    )
    expect(reportingOpenApi.paths["/v1/admin/reporting/runs/{id}"].get.description).toContain(
      "reports:export",
    )
    expect(reportingOpenApi.paths["/v1/admin/reporting/queries/parse"].post.requestBody).toMatchObject(
      { required: true },
    )
    expect(reportingOpenApi.paths["/v1/admin/reporting/reports/{id}"].patch.requestBody).toMatchObject(
      { required: true },
    )
    expect(
      reportingOpenApi.paths["/v1/admin/reporting/versions/{id}/runs"].post.requestBody,
    ).toMatchObject({ required: true })
  })
})
