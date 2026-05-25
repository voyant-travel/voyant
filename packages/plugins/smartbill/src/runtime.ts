import type { SmartbillArtifactPersistenceOptions } from "./artifacts.js"
import { createSmartbillClient, type SmartbillClientApi } from "./client.js"
import { mapVoyantInvoiceToSmartbillAsync, type SmartbillMappingOptions } from "./mapping.js"
import type { SmartbillLogger, SmartbillMapFn, SmartbillPluginOptions } from "./plugin.js"
import type { VoyantInvoiceEvent } from "./types.js"

export interface ResolvedSmartbillSyncEventNames {
  issued: string
  proformaIssued: string
  proformaConverted: string
  voided: string
  syncRequested: string
}

export interface SmartbillSyncRuntime {
  client: ReturnType<typeof createSmartbillClient>
  logger: SmartbillLogger
  mapEvent: SmartbillMapFn
  eventNames: ResolvedSmartbillSyncEventNames
  artifacts: SmartbillArtifactPersistenceOptions
  idempotency: NonNullable<SmartbillPluginOptions["idempotency"]>
  onError: SmartbillPluginOptions["onError"]
  writeBackInvoiceNumber: SmartbillPluginOptions["writeBackInvoiceNumber"]
}

export interface SmartbillSyncRuntimeOverrides {
  client?: SmartbillClientApi
}

export function createSmartbillSyncRuntime(
  options: SmartbillPluginOptions,
  overrides: SmartbillSyncRuntimeOverrides = {},
): SmartbillSyncRuntime {
  const client = overrides.client ?? createSmartbillClient(options)
  const logger = options.logger ?? console
  const mappingOptions: SmartbillMappingOptions = {
    companyVatCode: options.companyVatCode,
    seriesName: options.seriesName,
    language: options.language,
    isTaxIncluded: options.isTaxIncluded,
    measuringUnitName: options.measuringUnitName,
    art311SpecialRegime: options.art311SpecialRegime,
    art311SpecialRegimeText: options.art311SpecialRegimeText,
    mentions: options.mentions,
    observations: options.observations,
  }
  const mapEvent: SmartbillMapFn =
    options.mapEvent ??
    ((event: VoyantInvoiceEvent) => mapVoyantInvoiceToSmartbillAsync(event, mappingOptions))
  const eventNames: ResolvedSmartbillSyncEventNames = {
    issued: options.events?.issued ?? "invoice.issued",
    proformaIssued: options.events?.proformaIssued ?? "invoice.proforma.issued",
    proformaConverted: options.events?.proformaConverted ?? "invoice.proforma.converted",
    voided: options.events?.voided ?? "invoice.voided",
    syncRequested: options.events?.syncRequested ?? "invoice.external.sync.requested",
  }

  return {
    client,
    logger,
    mapEvent,
    eventNames,
    artifacts: {
      db: options.artifacts?.db ?? options.db,
      documentStorage: options.artifacts?.documentStorage ?? options.documentStorage,
      documentStorageKeyPrefix:
        options.artifacts?.documentStorageKeyPrefix ?? options.documentStorageKeyPrefix,
    },
    idempotency: {
      skipExistingExternalRef: options.idempotency?.skipExistingExternalRef ?? true,
    },
    onError: options.onError,
    writeBackInvoiceNumber: options.writeBackInvoiceNumber,
  }
}
