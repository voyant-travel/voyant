import type { LinkableDefinition } from "@voyant-travel/core"

export const policyLinkable: LinkableDefinition = {
  module: "legal",
  entity: "policy",
  table: "policies",
  idPrefix: "pol",
}

export const policyVersionLinkable: LinkableDefinition = {
  module: "legal",
  entity: "policyVersion",
  table: "policy_versions",
  idPrefix: "plvr",
}

export const policyAcceptanceLinkable: LinkableDefinition = {
  module: "legal",
  entity: "policyAcceptance",
  table: "policy_acceptances",
  idPrefix: "plac",
}

export const policiesLinkable = {
  policy: policyLinkable,
  policyVersion: policyVersionLinkable,
  policyAcceptance: policyAcceptanceLinkable,
}
