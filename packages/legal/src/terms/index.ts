export { legalTermLinkable, legalTermsLinkable } from "./linkables.js"
export type { LegalTermsAdminRoutes, LegalTermsPublicRoutes } from "./routes.js"
export { legalTermsAdminRoutes, legalTermsPublicRoutes } from "./routes.js"

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
