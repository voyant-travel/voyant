import type { LinkableDefinition } from "@voyant-travel/core"

export type { LegalTermsAdminRoutes, LegalTermsPublicRoutes } from "./routes.js"
export { legalTermsAdminRoutes, legalTermsPublicRoutes } from "./routes.js"

export const legalTermLinkable: LinkableDefinition = {
  module: "legal",
  entity: "term",
  table: "legal_terms",
  idPrefix: "ortm",
}

export const legalTermsLinkable = {
  term: legalTermLinkable,
}

export type { LegalTerm, NewLegalTerm } from "./schema.js"
export { legalTermAcceptanceStatusEnum, legalTerms, legalTermTypeEnum } from "./schema.js"
export type { CreateLegalTermInput, LegalTermListQuery, UpdateLegalTermInput } from "./service.js"
export { legalTermsService } from "./service.js"
export {
  insertLegalTermSchema,
  legalTermAcceptanceStatusSchema,
  legalTermListQuerySchema,
  legalTermTypeSchema,
  updateLegalTermSchema,
} from "./validation.js"
