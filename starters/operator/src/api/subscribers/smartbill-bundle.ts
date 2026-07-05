import type { HonoBundle } from "@voyant-travel/hono/plugin"

type SmartbillEnv = CloudflareBindings & {
  SMARTBILL_USERNAME?: string
  SMARTBILL_API_TOKEN?: string
  SMARTBILL_TOKEN?: string
  SMARTBILL_COMPANY_VAT_CODE?: string
  SMARTBILL_SERIES_NAME?: string
  SMARTBILL_INVOICE_SERIES_NAME?: string
  SMARTBILL_PROFORMA_SERIES_NAME?: string
}

export const smartbillOperatorBundle: HonoBundle = {
  name: "operator-smartbill",
  bootstrap: async (ctx) => {
    const env = ctx.bindings as SmartbillEnv
    if (!isSmartbillConfigured(env)) {
      console.warn(
        "[smartbill] Runtime bootstrap skipped: set SMARTBILL_USERNAME, SMARTBILL_TOKEN or SMARTBILL_API_TOKEN, SMARTBILL_COMPANY_VAT_CODE, and SMARTBILL_SERIES_NAME to enable SmartBill sync.",
      )
      return
    }

    const { smartbillOperatorBundle } = await import("./smartbill")
    await smartbillOperatorBundle.bootstrap?.(ctx)
  },
}

function isSmartbillConfigured(env: SmartbillEnv) {
  return Boolean(
    nonEmpty(env.SMARTBILL_USERNAME) &&
      (nonEmpty(env.SMARTBILL_API_TOKEN) ?? nonEmpty(env.SMARTBILL_TOKEN)) &&
      nonEmpty(env.SMARTBILL_COMPANY_VAT_CODE) &&
      (nonEmpty(env.SMARTBILL_INVOICE_SERIES_NAME) ?? nonEmpty(env.SMARTBILL_SERIES_NAME)),
  )
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}
