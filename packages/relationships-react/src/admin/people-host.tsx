"use client"

import { useAdminNavigate } from "@voyant-travel/admin"

import { PeoplePage } from "../components/people-page.js"

/**
 * Packaged admin host for the canonical `PeoplePage` (packaged-admin RFC
 * Phase 3). Zero-prop: opening a person resolves through the semantic
 * `person.detail` destination (RFC §4.7) instead of a host route tree, so
 * route files can mount this component directly.
 */
export function PeopleHost() {
  const navigateTo = useAdminNavigate()

  return (
    <PeoplePage onPersonOpen={(person) => navigateTo("person.detail", { personId: person.id })} />
  )
}
