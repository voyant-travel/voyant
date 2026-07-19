"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  CreateMediaFolderInput,
  UpdateMediaFolderInput,
} from "@voyant-travel/media/validation"

import {
  addAssetToFolder,
  createMediaFolder,
  deleteMediaFolder,
  removeAssetFromFolder,
  updateMediaFolder,
} from "../client.js"
import { useVoyantMediaContext } from "../provider.js"
import { mediaQueryKeys } from "../query-keys.js"

/** Folder CRUD plus asset↔folder membership add/remove. */
export function useFolderMutation() {
  const { baseUrl, fetcher } = useVoyantMediaContext()
  const queryClient = useQueryClient()
  const options = { baseUrl, fetcher }

  const invalidateFolders = () =>
    queryClient.invalidateQueries({ queryKey: mediaQueryKeys.folders() })
  const invalidateAssets = () =>
    queryClient.invalidateQueries({ queryKey: mediaQueryKeys.assets() })

  const create = useMutation({
    mutationFn: (input: CreateMediaFolderInput) => createMediaFolder(input, options),
    onSuccess: invalidateFolders,
  })

  const update = useMutation({
    mutationFn: ({ folderId, input }: { folderId: string; input: UpdateMediaFolderInput }) =>
      updateMediaFolder(folderId, input, options),
    onSuccess: invalidateFolders,
  })

  const remove = useMutation({
    mutationFn: (folderId: string) => deleteMediaFolder(folderId, options),
    onSuccess: invalidateFolders,
  })

  const addMember = useMutation({
    mutationFn: ({ folderId, assetId }: { folderId: string; assetId: string }) =>
      addAssetToFolder(folderId, assetId, options),
    onSuccess: async () => {
      await invalidateFolders()
      await invalidateAssets()
    },
  })

  const removeMember = useMutation({
    mutationFn: ({ folderId, assetId }: { folderId: string; assetId: string }) =>
      removeAssetFromFolder(folderId, assetId, options),
    onSuccess: async () => {
      await invalidateFolders()
      await invalidateAssets()
    },
  })

  return { create, update, remove, addMember, removeMember }
}
