import { NextResponse } from "next/server";
import { z } from "zod";
import { getRuntimeBindings } from "@/lib/cloudflare/context";
import { createApprovalRequest, getJournalEntryAuditContext, insertAuditLog } from "@/lib/db/repository";

const RequestSchema = z.object({
  journalEntryId: z.string().min(1),
  requesterUserId: z.string().min(1).default("operator"),
  approverUserId: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = RequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 });
  }

  const bindings = await getRuntimeBindings();
  const journalContext = await getJournalEntryAuditContext({
    db: bindings.DB,
    journalEntryId: parsed.data.journalEntryId,
  });

  if (!journalContext) {
    return NextResponse.json({ error: "Journal entry not found" }, { status: 404 });
  }

  const approvalId = await createApprovalRequest({
    db: bindings.DB,
    journalEntryId: parsed.data.journalEntryId,
    requesterUserId: parsed.data.requesterUserId,
    approverUserId: parsed.data.approverUserId,
  });

  await insertAuditLog({
    db: bindings.DB,
    organizationId: journalContext.organizationId,
    actorUserId: parsed.data.requesterUserId,
    action: "approval.requested",
    targetType: "approval_request",
    targetId: approvalId,
    payload: JSON.stringify({
      journalEntryId: parsed.data.journalEntryId,
      approverUserId: parsed.data.approverUserId ?? null,
      receiptId: journalContext.receiptId,
      sourceJobId: journalContext.sourceJobId,
    }),
  });

  return NextResponse.json({ requested: true, approvalId });
}
