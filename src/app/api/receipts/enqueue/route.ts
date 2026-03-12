import { NextResponse } from "next/server";
import { z } from "zod";
import { getRuntimeBindings } from "@/lib/cloudflare/context";
import { getActorHeader, getTenantHeader } from "@/lib/cloudflare/request-context";
import { insertAuditLog, insertExtractionJob } from "@/lib/db/repository";
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
  const actorUserId = await getActorHeader();
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
  await insertAuditLog({
    db: bindings.DB,
    organizationId: tenantId,
    actorUserId,
    action: "extraction.queued",
    targetType: "extraction_job",
    targetId: message.id,
    payload: JSON.stringify({
      receiptId: message.receiptId,
      objectKey: message.objectKey,
      provider: message.provider,
      clientId: message.clientId,
    }),
  });

  return NextResponse.json({
    queued: true,
    message,
  });
}
