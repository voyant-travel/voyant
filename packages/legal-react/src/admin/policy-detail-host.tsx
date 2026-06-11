"use client"

import { useAdminNavigate } from "@voyantjs/admin"

import { PolicyDetailPage } from "../components/policy-detail-page.js"
import { PolicyAssignmentDialog } from "./policy-assignment-dialog.js"
import { PolicyDialog } from "./policy-dialog.js"

export interface PolicyDetailHostProps {
  id: string
}

/**
 * Packaged admin host for the operator-grade policy detail page
 * (packaged-admin RFC Phase 3). Back-navigation resolves through the
 * `policy.list` semantic destination; the edit and assignment dialogs are
 * the packaged {@link PolicyDialog} / {@link PolicyAssignmentDialog}
 * (scoped pickers bound to their domain react hooks).
 */
export function PolicyDetailHost({ id }: PolicyDetailHostProps) {
  const navigateTo = useAdminNavigate()

  return (
    <PolicyDetailPage
      id={id}
      onBackToPolicies={() => navigateTo("policy.list", {})}
      renderPolicyDialog={(props) => <PolicyDialog {...props} />}
      renderPolicyAssignmentDialog={(props) => <PolicyAssignmentDialog {...props} />}
    />
  )
}
