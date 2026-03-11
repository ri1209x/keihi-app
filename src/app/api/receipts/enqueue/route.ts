import { NextResponse } from "next/server";
import { z } from "zod";
import { getRuntimeBindings } from "@/lib/cloudflare/context";
import { insertExtractionJob } from "@/lib/db/repository";
import { getTenantHeader } from "@/lib/cloudflare/request-context";
import { ExtractionQueueMessageSchema } from "@/types/queue/extraction";

const EnqueueSchema = z.object({
  receiptId: z.string().min(1),
  objectKey: z.string().min(1),
  provider: z.literal("gemini-2.5-flash").default("gemini-2.5-flash"),
  clientId: z.string().min(1),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = EnqueueSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const tenantId = await getTenantHeader();
  const message = ExtractionQueueMessageSchema.parse({
    id: crypto.randomUUID(),
    receiptId: parsed.data.receiptId,
    objectKey: parsed.data.objectKey,
    provider: parsed.data.provider,
    tenantId,
    clientId: parsed.data.clientId,
    enqueuedAt: new Date().toISOString(),
  });

  const bindings = await getRuntimeBindings();
  if (!bindings.EXTRACTION_QUEUE) {
    return NextResponse.json(
      { error: "EXTRACTION_QUEUE binding is not available" },
      { status: 501 },
    );
  }

  await bindings.EXTRACTION_QUEUE.send(message);
  await insertExtractionJob({ db: bindings.DB, message });

  return NextResponse.json({
    queued: true,
    message,
  });
}
