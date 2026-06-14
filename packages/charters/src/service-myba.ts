import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import { type BookingCharterDetail, bookingCharterDetails } from "./booking-extension.js"

/**
 * Minimal subset of `@voyant-travel/legal`'s `contractsService` we depend on.
 * Defined structurally so charters does NOT take a hard dependency on
 * the legal package — templates wire the real service in. Mirrors the
 * dependency-inversion pattern legal already uses for document
 * generators / event resolveDb.
 */
export interface CharterContractsService {
  getDefaultTemplate(
    db: PostgresJsDatabase,
    query: { scope?: string; language?: string; slug?: string },
  ): Promise<{ id: string; currentVersionId: string | null; slug: string } | null>

  getTemplateById(
    db: PostgresJsDatabase,
    id: string,
  ): Promise<{ id: string; currentVersionId: string | null; slug: string } | null>

  createContract(
    db: PostgresJsDatabase,
    data: {
      scope: "customer" | "supplier" | "partner" | "channel" | "other"
      title: string
      templateVersionId?: string | null
      personId?: string | null
      organizationId?: string | null
      bookingId?: string | null
      variables?: Record<string, unknown> | null
      language?: string
      metadata?: Record<string, unknown> | null
    },
  ): Promise<{ id: string } | null>
}

export type GenerateMybaContractInput = {
  bookingId: string
  /** Override the template that the booking_charter_details snapshotted. */
  templateIdOverride?: string | null
  /** Locale for the contract; defaults to "en". */
  language?: string
  /** Extra Liquid variables passed to the template renderer. Merged on top of
   *  the defaults generated from the booking + charter snapshot. */
  extraVariables?: Record<string, unknown>
  title?: string
}

export type GenerateMybaContractResult =
  | { status: "ok"; contractId: string; detail: BookingCharterDetail }
  | { status: "not_found" }
  | { status: "wrong_mode"; bookingMode: string }
  | { status: "no_template"; detail: BookingCharterDetail }
  | { status: "template_not_found"; templateId: string }
  | { status: "contract_create_failed" }

/**
 * Generate a MYBA contract for a whole-yacht booking and link it back via
 * `booking_charter_details.mybaContractId`. Idempotent in the
 * already-generated case: if `mybaContractId` is set, returns ok without
 * recreating.
 *
 * Resolves the template id with this precedence:
 *   1. `input.templateIdOverride`
 *   2. `booking_charter_details.mybaTemplateIdSnapshot` (recorded at
 *      booking-creation time from voyage override or product default)
 *   3. legal's default contract template (scope='customer', the slug
 *      conventionally used for MYBA — caller can also pass a slug via
 *      override).
 */
export const mybaService = {
  async generateContract(
    db: PostgresJsDatabase,
    contractsService: CharterContractsService,
    input: GenerateMybaContractInput,
  ): Promise<GenerateMybaContractResult> {
    const [detail] = await db
      .select()
      .from(bookingCharterDetails)
      .where(eq(bookingCharterDetails.bookingId, input.bookingId))
      .limit(1)
    if (!detail) return { status: "not_found" }
    if (detail.bookingMode !== "whole_yacht") {
      return { status: "wrong_mode", bookingMode: detail.bookingMode }
    }
    if (detail.mybaContractId) {
      return { status: "ok", contractId: detail.mybaContractId, detail }
    }

    const templateId = input.templateIdOverride ?? detail.mybaTemplateIdSnapshot
    let template: { id: string; currentVersionId: string | null; slug: string } | null = null
    if (templateId) {
      template = await contractsService.getTemplateById(db, templateId)
      if (!template) return { status: "template_not_found", templateId }
    } else {
      template = await contractsService.getDefaultTemplate(db, {
        scope: "customer",
        language: input.language ?? "en",
      })
      if (!template) return { status: "no_template", detail }
    }

    const variables: Record<string, unknown> = {
      bookingId: detail.bookingId,
      voyageId: detail.voyageId,
      voyageDisplayName: detail.voyageDisplayName,
      yachtName: detail.yachtName,
      yachtId: detail.yachtId,
      charterArea: detail.charterAreaSnapshot,
      guestCount: detail.guestCount,
      currency: detail.quotedCurrency,
      charterFee: detail.quotedCharterFee,
      apaPercent: detail.apaPercent,
      apaAmount: detail.apaAmount,
      total: detail.quotedTotal,
      ...(input.extraVariables ?? {}),
    }

    const contract = await contractsService.createContract(db, {
      scope: "customer",
      title:
        input.title ??
        `MYBA charter agreement — ${detail.voyageDisplayName ?? detail.voyageId ?? detail.bookingId}`,
      templateVersionId: template.currentVersionId,
      bookingId: detail.bookingId,
      variables,
      language: input.language ?? "en",
      metadata: {
        source: "charters",
        bookingMode: "whole_yacht",
        templateId: template.id,
        templateSlug: template.slug,
      },
    })
    if (!contract) return { status: "contract_create_failed" }

    const [updated] = await db
      .update(bookingCharterDetails)
      .set({ mybaContractId: contract.id, updatedAt: new Date() })
      .where(eq(bookingCharterDetails.bookingId, input.bookingId))
      .returning()
    if (!updated) return { status: "contract_create_failed" }
    return { status: "ok", contractId: contract.id, detail: updated }
  },
}
