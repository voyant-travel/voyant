"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  insertContractAttachmentSchema,
  updateContractAttachmentSchema,
} from "@voyantjs/legal/contracts/validation"
import type { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantLegalContext } from "../provider.js"
import { legalQueryKeys } from "../query-keys.js"
import { legalContractAttachmentSingleResponse, successEnvelope } from "../schemas.js"

export type CreateLegalContractAttachmentInput = z.input<typeof insertContractAttachmentSchema>
export type UpdateLegalContractAttachmentInput = z.input<typeof updateContractAttachmentSchema>
export interface UploadLegalContractAttachmentInput {
  file: File
  name?: string
  kind?: string
}

function createAttachmentUploadFormData(input: UploadLegalContractAttachmentInput) {
  const body = new FormData()
  body.set("file", input.file)
  if (input.name) body.set("name", input.name)
  if (input.kind) body.set("kind", input.kind)
  return body
}

export function useLegalContractAttachmentMutation() {
  const { baseUrl, fetcher } = useVoyantLegalContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async ({
      contractId,
      input,
    }: {
      contractId: string
      input: CreateLegalContractAttachmentInput
    }) => {
      const data = await fetchWithValidation(
        `/v1/admin/legal/contracts/${contractId}/attachments`,
        legalContractAttachmentSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return { contractId, data: data.data }
    },
    onSuccess: ({ contractId }) => {
      void queryClient.invalidateQueries({
        queryKey: legalQueryKeys.contractAttachments(contractId),
      })
    },
  })

  const update = useMutation({
    mutationFn: async ({
      contractId,
      id,
      input,
    }: {
      contractId: string
      id: string
      input: UpdateLegalContractAttachmentInput
    }) => {
      const data = await fetchWithValidation(
        `/v1/admin/legal/contracts/attachments/${id}`,
        legalContractAttachmentSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return { contractId, data: data.data }
    },
    onSuccess: ({ contractId }) => {
      void queryClient.invalidateQueries({
        queryKey: legalQueryKeys.contractAttachments(contractId),
      })
    },
  })

  const remove = useMutation({
    mutationFn: async ({ contractId, id }: { contractId: string; id: string }) =>
      fetchWithValidation(
        `/v1/admin/legal/contracts/attachments/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ).then((data) => ({ contractId, data })),
    onSuccess: ({ contractId }) => {
      void queryClient.invalidateQueries({
        queryKey: legalQueryKeys.contractAttachments(contractId),
      })
    },
  })

  const upload = useMutation({
    mutationFn: async ({
      contractId,
      input,
    }: {
      contractId: string
      input: UploadLegalContractAttachmentInput
    }) => {
      const data = await fetchWithValidation(
        `/v1/admin/legal/contracts/${contractId}/attachments/upload`,
        legalContractAttachmentSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: createAttachmentUploadFormData(input) },
      )
      return { contractId, data: data.data }
    },
    onSuccess: ({ contractId }) => {
      void queryClient.invalidateQueries({
        queryKey: legalQueryKeys.contractAttachments(contractId),
      })
    },
  })

  const replaceFile = useMutation({
    mutationFn: async ({
      contractId,
      id,
      input,
    }: {
      contractId: string
      id: string
      input: UploadLegalContractAttachmentInput
    }) => {
      const data = await fetchWithValidation(
        `/v1/admin/legal/contracts/attachments/${id}/upload`,
        legalContractAttachmentSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: createAttachmentUploadFormData(input) },
      )
      return { contractId, data: data.data }
    },
    onSuccess: ({ contractId }) => {
      void queryClient.invalidateQueries({
        queryKey: legalQueryKeys.contractAttachments(contractId),
      })
    },
  })

  return { create, update, remove, upload, replaceFile }
}
