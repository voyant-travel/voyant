/**
 * Operator settings HTTP routes — the admin/public CRUD surface over the
 * settings service. Absolute paths (kept stable from the prior deployment-local
 * routes): `/v1/admin/settings/*`, `/v1/public/operator-profile`,
 * `/v1/public/settings/operator`.
 */

import { parseJsonBody } from "@voyant-travel/hono"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { Context, Hono } from "hono"

import {
  getOperatorPaymentDefaults,
  getOperatorPaymentInstructions,
  getOperatorProfile,
  getOperatorSettings,
  toPublicOperatorProfile,
  toPublicOperatorSettings,
  updateOperatorPaymentDefaultsSchema,
  updateOperatorPaymentInstructionsSchema,
  updateOperatorProfileSchema,
  updateOperatorSettingsSchema,
  upsertOperatorPaymentDefaults,
  upsertOperatorPaymentInstructions,
  upsertOperatorProfile,
  upsertOperatorSettings,
} from "./service.js"

const PUBLIC_OPERATOR_SETTINGS_CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=600"

function cachePublicOperatorSettings(c: Context) {
  c.header("Cache-Control", PUBLIC_OPERATOR_SETTINGS_CACHE_CONTROL)
}

async function handleGetOperatorProfile(c: Context): Promise<Response> {
  const db = c.get("db") as PostgresJsDatabase
  return c.json({ data: await getOperatorProfile(db) })
}

async function handlePatchOperatorProfile(c: Context): Promise<Response> {
  const db = c.get("db") as PostgresJsDatabase
  const patch = await parseJsonBody(c, updateOperatorProfileSchema)
  return c.json({ data: await upsertOperatorProfile(db, patch) })
}

async function handleGetOperatorPaymentInstructions(c: Context): Promise<Response> {
  const db = c.get("db") as PostgresJsDatabase
  return c.json({ data: await getOperatorPaymentInstructions(db) })
}

async function handlePatchOperatorPaymentInstructions(c: Context): Promise<Response> {
  const db = c.get("db") as PostgresJsDatabase
  const patch = await parseJsonBody(c, updateOperatorPaymentInstructionsSchema)
  return c.json({ data: await upsertOperatorPaymentInstructions(db, patch) })
}

async function handleGetOperatorPaymentDefaults(c: Context): Promise<Response> {
  const db = c.get("db") as PostgresJsDatabase
  return c.json({ data: await getOperatorPaymentDefaults(db) })
}

async function handlePatchOperatorPaymentDefaults(c: Context): Promise<Response> {
  const db = c.get("db") as PostgresJsDatabase
  const patch = await parseJsonBody(c, updateOperatorPaymentDefaultsSchema)
  return c.json({ data: await upsertOperatorPaymentDefaults(db, patch) })
}

async function handleGetPublicOperatorProfile(c: Context): Promise<Response> {
  const db = c.get("db") as PostgresJsDatabase
  const [profile, defaults] = await Promise.all([
    getOperatorProfile(db),
    getOperatorPaymentDefaults(db),
  ])
  cachePublicOperatorSettings(c)
  if (!profile) return c.json({ data: null })
  return c.json({ data: toPublicOperatorProfile(profile, defaults) })
}

async function handleGetOperatorSettings(c: Context): Promise<Response> {
  const db = c.get("db") as PostgresJsDatabase
  return c.json({ data: await getOperatorSettings(db) })
}

async function handlePatchOperatorSettings(c: Context): Promise<Response> {
  const db = c.get("db") as PostgresJsDatabase
  const patch = await parseJsonBody(c, updateOperatorSettingsSchema)
  return c.json({ data: await upsertOperatorSettings(db, patch) })
}

async function handleGetPublicOperatorSettings(c: Context): Promise<Response> {
  const db = c.get("db") as PostgresJsDatabase
  const row = await getOperatorSettings(db)
  cachePublicOperatorSettings(c)
  if (!row) return c.json({ data: null })
  return c.json({ data: toPublicOperatorSettings(row) })
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
