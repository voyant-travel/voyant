export {
  contractLinkable,
  contractsLinkable,
  contractTemplateLinkable,
} from "./contracts/linkables.js"
export {
  policiesLinkable,
  policyAcceptanceLinkable,
  policyLinkable,
  policyVersionLinkable,
} from "./policies/linkables.js"
export { legalTermLinkable, legalTermsLinkable } from "./terms/linkables.js"

import { contractsLinkable } from "./contracts/linkables.js"
import { policiesLinkable } from "./policies/linkables.js"
import { legalTermsLinkable } from "./terms/linkables.js"

export const legalLinkable = {
  ...contractsLinkable,
  ...policiesLinkable,
  ...legalTermsLinkable,
}
