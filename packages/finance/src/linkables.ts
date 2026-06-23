import type { LinkableDefinition } from "@voyant-travel/core"

export const invoiceLinkable: LinkableDefinition = {
  module: "finance",
  entity: "invoice",
  table: "invoices",
  idPrefix: "inv",
}

export const invoiceTemplateLinkable: LinkableDefinition = {
  module: "finance",
  entity: "invoiceTemplate",
  table: "invoice_templates",
  idPrefix: "invt",
}

export const creditNoteLinkable: LinkableDefinition = {
  module: "finance",
  entity: "creditNote",
  table: "credit_notes",
  idPrefix: "crn",
}

export const supplierInvoiceLinkable: LinkableDefinition = {
  module: "finance",
  entity: "supplierInvoice",
  table: "supplier_invoices",
  idPrefix: "sinv",
}

export const financeLinkable = {
  invoice: invoiceLinkable,
  invoiceTemplate: invoiceTemplateLinkable,
  creditNote: creditNoteLinkable,
  supplierInvoice: supplierInvoiceLinkable,
}
