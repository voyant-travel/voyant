import { sql } from "drizzle-orm"

export const ensurePgcryptoExtension = sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`
export const ensureUnaccentExtension = sql`CREATE EXTENSION IF NOT EXISTS "unaccent";`
export const ensureIamSchema = sql`CREATE SCHEMA IF NOT EXISTS "iam";`
export const ensureCustomerAuthSchema = sql`CREATE SCHEMA IF NOT EXISTS "customer_auth";`
export const ensureInfraSchema = sql`CREATE SCHEMA IF NOT EXISTS "infra";`
