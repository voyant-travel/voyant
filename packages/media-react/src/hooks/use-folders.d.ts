import { type MediaFoldersListFilters } from "../query-keys.js"
export interface UseFoldersOptions extends MediaFoldersListFilters {
  enabled?: boolean
}
/** List folders (optionally scoped to a `parentId`). */
export declare function useFolders(
  options?: UseFoldersOptions,
): import("@tanstack/react-query").UseQueryResult<
  NoInfer<{
    data: {
      id: string
      name: string
      parentId: string | null
      createdAt: string
      updatedAt: string
    }[]
    total: number
    limit: number
    offset: number
  }>,
  Error
>
