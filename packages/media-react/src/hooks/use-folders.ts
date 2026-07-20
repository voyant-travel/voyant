"use client"

import { useQuery } from "@tanstack/react-query"

import { listMediaFolders } from "../client.js"
import { useVoyantMediaContext } from "../provider.js"
import { type MediaFoldersListFilters, mediaQueryKeys } from "../query-keys.js"

export interface UseFoldersOptions extends MediaFoldersListFilters {
  enabled?: boolean
}

/** List folders (optionally scoped to a `parentId`). */
export function useFolders(options: UseFoldersOptions = {}) {
  const { baseUrl, fetcher } = useVoyantMediaContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    queryKey: mediaQueryKeys.foldersList(filters),
    queryFn: () => listMediaFolders(filters, { baseUrl, fetcher }),
    enabled,
  })
}
