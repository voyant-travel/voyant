import { createSmartbillClient } from "./client.js"
import { mapVoyantInvoiceToSmartbill, type SmartbillMappingOptions } from "./mapping.js"
import type { SmartbillLogger, SmartbillMapFn, SmartbillPluginOptions } from "./plugin.js"
import type { VoyantInvoiceEvent } from "./types.js"

export interface ResolvedSmartbillSyncEventNames {
  issued: string
  proformaIssued: string
  voided: string
  syncRequested: string
}

export interface SmartbillSyncRuntime {
  client: ReturnType<typeof createSmartbillClient>
  logger: SmartbillLogger
  mapEvent: SmartbillMapFn
  eventNames: ResolvedSmartbillSyncEventNames
}

export function createSmartbillSyncRuntime(options: SmartbillPluginOptions): SmartbillSyncRuntime {
  const client = createSmartbillClient(options)
  const logger = options.logger ?? console
  const mappingOptions: SmartbillMappingOptions = {
    companyVatCode: options.companyVatCode,
    seriesName: options.seriesName,
    language: options.language,
    isTaxIncluded: options.isTaxIncluded,
    art311SpecialRegime: options.art311SpecialRegime,
  }
  const mapEvent: SmartbillMapFn =
    options.mapEvent ??
    ((event: VoyantInvoiceEvent) => mapVoyantInvoiceToSmartbill(event, mappingOptions))
  const eventNames: ResolvedSmartbillSyncEventNames = {
    issued: options.events?.issued ?? "invoice.issued",
    proformaIssued: options.events?.proformaIssued ?? "invoice.proforma.issued",
    voided: options.events?.voided ?? "invoice.voided",
    syncRequested: options.events?.syncRequested ?? "invoice.external.sync.requested",
  }

  return {
    client,
    logger,
    mapEvent,
    eventNames,
  }
}
