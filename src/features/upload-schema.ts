import { z } from "zod";

export const UploadRequestSchema = z.object({
  clientId: z.string().min(1),
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  contentLength: z.number().int().positive().max(20 * 1024 * 1024).optional(),
});

export type UploadRequestInput = z.infer<typeof UploadRequestSchema>;
