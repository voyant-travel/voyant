import { spriteRemoteWorkspaceAdapter } from "../scripts/lib/agent-runner-sprite-workspace.mjs"

export const remoteWorkspaceAdapters = {
  sprite: (workspace) => spriteRemoteWorkspaceAdapter(workspace),
}
