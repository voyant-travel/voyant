import type { WorkflowManifest } from "@voyantjs/workflows/protocol"
import { describe, expect, test } from "vitest"

import { routeEvent } from "../event-router.js"

function makeManifest(filters: WorkflowManifest["eventFilters"]): WorkflowManifest {
  return {
    schemaVersion: 1,
    projectId: "default",
    versionId: "v_test",
    builtAt: 1_700_000_000_000,
    builderVersion: "test",
    capabilities: {
      trigger: true,
      events: true,
      schedules: true,
      rerun: true,
      resume: true,
      cancel: true,
      humanApproval: false,
      stepRerun: false,
    },
    workflows: [],
    eventFilters: filters,
    diagnostics: [],
    bindings: {},
    environments: { production: {}, preview: {}, development: {} },
  }
}

const ENV = {
  name: "promotion.changed",
  data: { affected: { kind: "all" }, offerId: "pofr_01" },
  metadata: { tenantId: "default", eventId: "evt_01" },
  emittedAt: "2026-05-09T13:22:08.000Z",
}

describe("routeEvent", () => {
  test("filters by eventType", () => {
    const manifest = makeManifest([
      { id: "ef_a", eventType: "promotion.changed", payloadHash: "h", targetWorkflowId: "wf-a" },
      { id: "ef_b", eventType: "other.event", payloadHash: "h", targetWorkflowId: "wf-b" },
    ])
    const matches = routeEvent({ manifest, envelope: ENV, eventId: "evt_01" })
    expect(matches).toHaveLength(1)
    expect(matches[0]).toMatchObject({ filterId: "ef_a", status: "matched" })
  })

  test("evaluates where predicate", () => {
    const manifest = makeManifest([
      {
        id: "ef_match",
        eventType: "promotion.changed",
        where: { eq: [{ path: "data.affected.kind" }, { lit: "all" }] },
        payloadHash: "h",
        targetWorkflowId: "wf",
      },
      {
        id: "ef_nomatch",
        eventType: "promotion.changed",
        where: { eq: [{ path: "data.affected.kind" }, { lit: "products" }] },
        payloadHash: "h",
        targetWorkflowId: "wf",
      },
    ])
    const matches = routeEvent({ manifest, envelope: ENV, eventId: "evt_01" })
    expect(matches.map((m) => m.filterId)).toEqual(["ef_match"])
  })

  test("applies input mapper", () => {
    const manifest = makeManifest([
      {
        id: "ef_mapped",
        eventType: "promotion.changed",
        input: {
          object: {
            sellerOperatorId: { path: "metadata.tenantId" },
            offerId: { path: "data.offerId" },
          },
        },
        payloadHash: "h",
        targetWorkflowId: "wf",
      },
    ])
    const matches = routeEvent({ manifest, envelope: ENV, eventId: "evt_01" })
    expect(matches).toHaveLength(1)
    const m = matches[0]
    if (m?.status !== "matched") throw new Error("expected matched")
    expect(m.input).toEqual({ sellerOperatorId: "default", offerId: "pofr_01" })
  })

  test("undefined input maps to envelope.data", () => {
    const manifest = makeManifest([
      {
        id: "ef_passthrough",
        eventType: "promotion.changed",
        payloadHash: "h",
        targetWorkflowId: "wf",
      },
    ])
    const matches = routeEvent({ manifest, envelope: ENV, eventId: "evt_01" })
    const m = matches[0]
    if (m?.status !== "matched") throw new Error("expected matched")
    expect(m.input).toEqual(ENV.data)
  })

  test("derives idempotencyKey from filterId + eventId", () => {
    const manifest = makeManifest([
      { id: "ef_x", eventType: "promotion.changed", payloadHash: "h", targetWorkflowId: "wf" },
    ])
    const matches = routeEvent({ manifest, envelope: ENV, eventId: "evt_xyz" })
    const m = matches[0]
    if (m?.status !== "matched") throw new Error("expected matched")
    expect(m.idempotencyKey).toBe("ef_x:evt_xyz")
  })

  test("idempotencyOverride supersedes eventId", () => {
    const manifest = makeManifest([
      { id: "ef_x", eventType: "promotion.changed", payloadHash: "h", targetWorkflowId: "wf" },
    ])
    const matches = routeEvent({
      manifest,
      envelope: ENV,
      eventId: "evt_xyz",
      idempotencyOverride: "supplied",
    })
    const m = matches[0]
    if (m?.status !== "matched") throw new Error("expected matched")
    expect(m.idempotencyKey).toBe("ef_x:supplied")
  })

  test("multiple filters can match same envelope", () => {
    const manifest = makeManifest([
      { id: "ef_a", eventType: "promotion.changed", payloadHash: "h", targetWorkflowId: "wf-a" },
      { id: "ef_b", eventType: "promotion.changed", payloadHash: "h", targetWorkflowId: "wf-b" },
    ])
    const matches = routeEvent({ manifest, envelope: ENV, eventId: "evt_01" })
    expect(matches.map((m) => m.filterId)).toEqual(["ef_a", "ef_b"])
  })

  test("isolates predicate eval errors per filter", () => {
    const manifest = makeManifest([
      {
        id: "ef_bad",
        eventType: "promotion.changed",
        where: { wat: ["x"] } as never,
        payloadHash: "h",
        targetWorkflowId: "wf",
      },
      {
        id: "ef_ok",
        eventType: "promotion.changed",
        where: { eq: [{ path: "data.affected.kind" }, { lit: "all" }] },
        payloadHash: "h",
        targetWorkflowId: "wf",
      },
    ])
    const matches = routeEvent({ manifest, envelope: ENV, eventId: "evt_01" })
    const skipped = matches.find((m) => m.filterId === "ef_bad")
    const matched = matches.find((m) => m.filterId === "ef_ok")
    expect(skipped?.status).toBe("skipped")
    expect(matched?.status).toBe("matched")
  })

  test("isolates input projection errors per filter", () => {
    const manifest = makeManifest([
      {
        id: "ef_bad_input",
        eventType: "promotion.changed",
        input: { wat: 1 } as never,
        payloadHash: "h",
        targetWorkflowId: "wf",
      },
      {
        id: "ef_ok",
        eventType: "promotion.changed",
        payloadHash: "h",
        targetWorkflowId: "wf",
      },
    ])
    const matches = routeEvent({ manifest, envelope: ENV, eventId: "evt_01" })
    const skipped = matches.find((m) => m.filterId === "ef_bad_input")
    expect(skipped?.status).toBe("skipped")
    if (skipped?.status === "skipped") {
      expect(skipped.reason).toBe("input_projection_error")
    }
  })
})
