"use client"
import { useQuery } from "@tanstack/react-query"
import { listMediaFolders } from "../client.js"
import { useVoyantMediaContext } from "../provider.js"
import { mediaQueryKeys } from "../query-keys.js"
/** List folders (optionally scoped to a `parentId`). */
export function useFolders(options = {}) {
  const { baseUrl, fetcher } = useVoyantMediaContext()
  const { enabled = true, ...filters } = options
  return useQuery({
    queryKey: mediaQueryKeys.foldersList(filters),
    queryFn: () => listMediaFolders(filters, { baseUrl, fetcher }),
    enabled,
  })
}
