"use client"

import type * as React from "react"

export type OperatorAdminBootstrapMode = "single-tenant" | "organization"

export interface OperatorAdminBootstrapRenderState<TUser, TWorkspace> {
  user: TUser
  workspace: TWorkspace | null | undefined
  mode: OperatorAdminBootstrapMode
}

export interface OperatorAdminBootstrapGateProps<TUser, TWorkspace = unknown> {
  children:
    | React.ReactNode
    | ((state: OperatorAdminBootstrapRenderState<TUser, TWorkspace>) => React.ReactNode)
  /**
   * Voyant first-party starters are single-tenant per deployment. In that
   * baseline, current-user readiness is the only shell bootstrap dependency.
   * Use "organization" only when an app explicitly owns workspace switching.
   */
  mode?: OperatorAdminBootstrapMode
  user: TUser | null | undefined
  isUserLoading?: boolean
  workspace?: TWorkspace | null
  isWorkspaceLoading?: boolean
  isWorkspaceReady?: (workspace: TWorkspace | null | undefined) => boolean
  loadingFallback?: React.ReactNode
  unauthenticatedFallback?: React.ReactNode
  missingWorkspaceFallback?: React.ReactNode
}

function renderChildren<TUser, TWorkspace>(
  children: OperatorAdminBootstrapGateProps<TUser, TWorkspace>["children"],
  state: OperatorAdminBootstrapRenderState<TUser, TWorkspace>,
) {
  return typeof children === "function" ? children(state) : children
}

export function OperatorAdminBootstrapGate<TUser, TWorkspace = unknown>({
  children,
  mode = "single-tenant",
  user,
  isUserLoading = false,
  workspace,
  isWorkspaceLoading = false,
  isWorkspaceReady = Boolean,
  loadingFallback = null,
  unauthenticatedFallback = null,
  missingWorkspaceFallback = null,
}: OperatorAdminBootstrapGateProps<TUser, TWorkspace>) {
  if (isUserLoading) {
    return <>{loadingFallback}</>
  }

  if (!user) {
    return <>{unauthenticatedFallback}</>
  }

  if (mode === "organization") {
    if (isWorkspaceLoading) {
      return <>{loadingFallback}</>
    }

    if (!isWorkspaceReady(workspace)) {
      return <>{missingWorkspaceFallback}</>
    }
  }

  return <>{renderChildren(children, { user, workspace, mode })}</>
}
