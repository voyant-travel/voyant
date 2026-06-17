/**
 * Operator profile and payment settings HTTP routes.
 *
 * The settings schema + data-access readers/writers live in the standard
 * `@voyant-travel/operator-settings` package (Workstream B step 4, Stage 1).
 * This file is only the deployment's HTTP layer over that service — the route
 * handlers + `mountOperatorSettingsRoutes`. The deployment's runtime wiring
 * imports the readers directly from `@voyant-travel/operator-settings`.
 */

import { parseJsonBody } from "@voyant-travel/hono"
// Data access lives in @voyant-travel/operator-settings; this file is just the
// deployment's HTTP layer over it. Runtime wiring imports the readers directly
// from the package, not from here.
import * as settings from "@voyant-travel/operator-settings"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context, Hono } from "hono"

const PUBLIC_OPERATOR_SETTINGS_CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=600"

function cachePublicOperatorSettings(c: Context) {
  c.header("Cache-Control", PUBLIC_OPERATOR_SETTINGS_CACHE_CONTROL)
}

async function handleGetOperatorProfile(c: Context): Promise<Response> {
  const db = c.get("db") as PostgresJsDatabase
  return c.json({ data: await settings.getOperatorProfile(db) })
}

async function handlePatchOperatorProfile(c: Context): Promise<Response> {
  const db = c.get("db") as PostgresJsDatabase
  const patch = await parseJsonBody(c, settings.updateOperatorProfileSchema)
  return c.json({ data: await settings.upsertOperatorProfile(db, patch) })
}

async function handleGetOperatorPaymentInstructions(c: Context): Promise<Response> {
  const db = c.get("db") as PostgresJsDatabase
  return c.json({ data: await settings.getOperatorPaymentInstructions(db) })
}

async function handlePatchOperatorPaymentInstructions(c: Context): Promise<Response> {
  const db = c.get("db") as PostgresJsDatabase
  const patch = await parseJsonBody(c, settings.updateOperatorPaymentInstructionsSchema)
  return c.json({ data: await settings.upsertOperatorPaymentInstructions(db, patch) })
}

async function handleGetOperatorPaymentDefaults(c: Context): Promise<Response> {
  const db = c.get("db") as PostgresJsDatabase
  return c.json({ data: await settings.getOperatorPaymentDefaults(db) })
}

async function handlePatchOperatorPaymentDefaults(c: Context): Promise<Response> {
  const db = c.get("db") as PostgresJsDatabase
  const patch = await parseJsonBody(c, settings.updateOperatorPaymentDefaultsSchema)
  return c.json({ data: await settings.upsertOperatorPaymentDefaults(db, patch) })
}

async function handleGetPublicOperatorProfile(c: Context): Promise<Response> {
  const db = c.get("db") as PostgresJsDatabase
  const [profile, defaults] = await Promise.all([
    settings.getOperatorProfile(db),
    settings.getOperatorPaymentDefaults(db),
  ])
  cachePublicOperatorSettings(c)
  if (!profile) return c.json({ data: null })
  return c.json({ data: settings.toPublicOperatorProfile(profile, defaults) })
}

async function handleGetOperatorSettings(c: Context): Promise<Response> {
  const db = c.get("db") as PostgresJsDatabase
  return c.json({ data: await settings.getOperatorSettings(db) })
}

async function handlePatchOperatorSettings(c: Context): Promise<Response> {
  const db = c.get("db") as PostgresJsDatabase
  const patch = await parseJsonBody(c, settings.updateOperatorSettingsSchema)
  return c.json({ data: await settings.upsertOperatorSettings(db, patch) })
}

async function handleGetPublicOperatorSettings(c: Context): Promise<Response> {
  const db = c.get("db") as PostgresJsDatabase
  const row = await settings.getOperatorSettings(db)
  cachePublicOperatorSettings(c)
  if (!row) return c.json({ data: null })
  return c.json({ data: settings.toPublicOperatorSettings(row) })
}

export function mountOperatorSettingsRoutes(hono: Hono): void {
  hono.get("/v1/admin/settings/operator-profile", handleGetOperatorProfile)
  hono.patch("/v1/admin/settings/operator-profile", handlePatchOperatorProfile)
  hono.get("/v1/admin/settings/operator-payment-instructions", handleGetOperatorPaymentInstructions)
  hono.patch(
    "/v1/admin/settings/operator-payment-instructions",
    handlePatchOperatorPaymentInstructions,
  )
  hono.get("/v1/admin/settings/operator-payment-defaults", handleGetOperatorPaymentDefaults)
  hono.patch("/v1/admin/settings/operator-payment-defaults", handlePatchOperatorPaymentDefaults)
  hono.get("/v1/public/operator-profile", handleGetPublicOperatorProfile)

  hono.get("/v1/admin/settings/operator", handleGetOperatorSettings)
  hono.patch("/v1/admin/settings/operator", handlePatchOperatorSettings)
  hono.get("/v1/public/settings/operator", handleGetPublicOperatorSettings)
}
