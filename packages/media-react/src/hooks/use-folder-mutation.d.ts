import type { UpdateMediaFolderInput } from "@voyant-travel/media/validation"
/** Folder CRUD plus asset↔folder membership add/remove. */
export declare function useFolderMutation(): {
  create: import("@tanstack/react-query").UseMutationResult<
    {
      data: {
        id: string
        name: string
        parentId: string | null
        createdAt: string
        updatedAt: string
      }
    },
    Error,
    {
      name: string
      parentId?: string | null | undefined
    },
    unknown
  >
  update: import("@tanstack/react-query").UseMutationResult<
    {
      data: {
        id: string
        name: string
        parentId: string | null
        createdAt: string
        updatedAt: string
      }
    },
    Error,
    {
      folderId: string
      input: UpdateMediaFolderInput
    },
    unknown
  >
  remove: import("@tanstack/react-query").UseMutationResult<
    {
      data: {
        id: string
        name: string
        parentId: string | null
        createdAt: string
        updatedAt: string
      }
    },
    Error,
    string,
    unknown
  >
  addMember: import("@tanstack/react-query").UseMutationResult<
    {
      data: {
        id: string
        assetId: string
        folderId: string
        createdAt: string
      }
    },
    Error,
    {
      folderId: string
      assetId: string
    },
    unknown
  >
  removeMember: import("@tanstack/react-query").UseMutationResult<
    {
      data: {
        removed: boolean
      }
    },
    Error,
    {
      folderId: string
      assetId: string
    },
    unknown
  >
}
