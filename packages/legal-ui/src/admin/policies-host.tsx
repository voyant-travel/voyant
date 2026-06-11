"use client"

import { useAdminNavigate } from "@voyantjs/admin"

import { PoliciesPage } from "../components/policies-page.js"
import { PolicyDialog } from "./policy-dialog.js"

/**
 * Packaged admin host for the operator-grade policies list page
 * (packaged-admin RFC Phase 3). Zero-prop: list state stays
 * component-local, opening a row resolves through the `policy.detail`
 * semantic destination, and the create dialog is the packaged
 * {@link PolicyDialog}.
 */
export function PoliciesHost() {
  const navigateTo = useAdminNavigate()

  return (
    <PoliciesPage
      onOpenPolicy={(id) => navigateTo("policy.detail", { policyId: id })}
      renderPolicyDialog={(props) => <PolicyDialog {...props} />}
    />
  )
}
