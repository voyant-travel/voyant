import {
  customFieldDefinitionInputSchema,
  customFieldTypeSchema,
} from "@voyant-travel/custom-fields/contracts"
import { listResponseSchema } from "@voyant-travel/types"
import { z } from "zod"

const single = <T extends z.ZodTypeAny>(schema: T) => z.object({ data: schema })
export const customFieldDefinitionRecordSchema = customFieldDefinitionInputSchema.extend({
  id: z.string(),
  namespace: z.string(),
  ownerKind: z.enum(["platform", "operator", "app"]),
  ownerId: z.string().nullable(),
  lifecycleState: z.enum(["active", "inactive", "deprecated"]),
  provenance: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type CustomFieldDefinitionRecord = z.infer<typeof customFieldDefinitionRecordSchema>
export const customFieldDefinitionListResponse = listResponseSchema(
  customFieldDefinitionRecordSchema,
)
export const customFieldDefinitionSingleResponse = single(customFieldDefinitionRecordSchema)
export const customFieldTargetsResponse = single(
  z.array(
    z.object({
      id: z.string(),
      namespace: z.string(),
      label: z.string(),
      fieldTypes: z.array(customFieldTypeSchema),
      capabilities: z.array(
        z.enum(["read", "write", "search", "export", "invoice", "presentation"]),
      ),
      ownerUnitId: z.string(),
    }),
  ),
)
export type CustomFieldTargetRecord = z.infer<typeof customFieldTargetsResponse>["data"][number]
export const successEnvelope = z.object({ success: z.boolean() })
