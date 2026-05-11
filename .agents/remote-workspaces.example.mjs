import { spriteCliRemoteWorkspaceAdapter } from "../scripts/lib/agent-runner-sprite-workspace.mjs"

export const remoteWorkspaceAdapters = {
  sprite: (workspace) => spriteCliRemoteWorkspaceAdapter(workspace),
}
