import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession, hasRequiredRole } from "@/lib/auth/session";
import { getRuntimeBindings } from "@/lib/cloudflare/context";
import { createApprovalRequest, getJournalEntryAuditContext, insertAuditLog } from "@/lib/db/repository";

const RequestSchema = z.object({
  journalEntryId: z.string().min(1),
  approverUserId: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = RequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 });
  }

  const bindings = await getRuntimeBindings();
  const session = await getCurrentSession(bindings);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasRequiredRole(session.role, ["operator"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const journalContext = await getJournalEntryAuditContext({
    db: bindings.DB,
    journalEntryId: parsed.data.journalEntryId,
    organizationId: session.organizationId,
  });

  if (!journalContext) {
    return NextResponse.json({ error: "Journal entry not found" }, { status: 404 });
  }

  const approvalId = await createApprovalRequest({
    db: bindings.DB,
    journalEntryId: parsed.data.journalEntryId,
    requesterUserId: session.id,
    approverUserId: parsed.data.approverUserId,
  });

  await insertAuditLog({
    db: bindings.DB,
    organizationId: journalContext.organizationId,
    actorUserId: session.id,
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
