import { z } from "zod"

/**
 * KMS Encrypted Envelope schema.
 * All toxic PII is encrypted with GCP KMS before storage.
 * Format: { enc: "base64-encoded-ciphertext" }
 */
export const kmsEnvelopeSchema = z
  .object({
    enc: z.string().min(1, "Encrypted value is required"),
  })
  .nullable()

export type KmsEnvelope = z.infer<typeof kmsEnvelopeSchema>
