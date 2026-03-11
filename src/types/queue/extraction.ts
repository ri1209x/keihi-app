import { z } from "zod";

export const ExtractionQueueMessageSchema = z.object({
  id: z.string().min(1),
  receiptId: z.string().min(1),
  objectKey: z.string().min(1),
  provider: z.literal("gemini-2.5-flash").default("gemini-2.5-flash"),
  tenantId: z.string().min(1),
  clientId: z.string().min(1),
  enqueuedAt: z.string().min(1),
});

export type ExtractionQueueMessage = z.infer<typeof ExtractionQueueMessageSchema>;
