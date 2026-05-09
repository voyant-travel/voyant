import { type KmsEnvelope, kmsEnvelopeSchema } from "@voyantjs/db/schema/iam"
import { z } from "zod"

export const transactionTravelerIdentitySchema = z.object({
  dateOfBirth: z.string().optional().nullable(),
  nationality: z.string().max(2).optional().nullable(),
})

export const decryptedTransactionTravelerIdentitySchema = z.object({
  travelerId: z.string(),
  travelerKind: z.enum(["offer", "order"]),
  dateOfBirth: z.string().nullable(),
  nationality: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const transactionTravelerIdentityEnvelopeSchema = z.object({
  // `z.lazy(() => …)` defers cross-package schema dereferencing until
  // first parse — see #501 for why bundlers that split this file from
  // its `@voyantjs/db` producer crash without it.
  identityEncrypted: z
    .lazy(() => kmsEnvelopeSchema)
    .optional()
    .nullable(),
})

export const transactionParticipantIdentitySchema = transactionTravelerIdentitySchema
export const decryptedTransactionParticipantIdentitySchema =
  decryptedTransactionTravelerIdentitySchema.transform(({ travelerId, travelerKind, ...rest }) => ({
    ...rest,
    participantId: travelerId,
    participantKind: travelerKind,
  }))
export const transactionParticipantIdentityEnvelopeSchema =
  transactionTravelerIdentityEnvelopeSchema

export type TransactionTravelerIdentity = z.infer<typeof transactionTravelerIdentitySchema>
export type TransactionTravelerIdentityEnvelope = {
  identityEncrypted?: KmsEnvelope | null
}
export type DecryptedTransactionTravelerIdentity = z.infer<
  typeof decryptedTransactionTravelerIdentitySchema
>
export type TransactionParticipantIdentity = TransactionTravelerIdentity
export type TransactionParticipantIdentityEnvelope = TransactionTravelerIdentityEnvelope
export type DecryptedTransactionParticipantIdentity = z.infer<
  typeof decryptedTransactionParticipantIdentitySchema
>
