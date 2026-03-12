import { NextResponse } from "next/server";
import { z } from "zod";
import { getRuntimeBindings } from "@/lib/cloudflare/context";
import { approveRequest, getApprovalAuditContext, insertAuditLog } from "@/lib/db/repository";

const ApproveSchema = z.object({
  approverUserId: z.string().min(1).default("approver"),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ approvalId: string }> },
) {
  const { approvalId } = await params;
  const body = await request.json();
  const parsed = ApproveSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 });
  }

  const bindings = await getRuntimeBindings();
  const approvalContext = await getApprovalAuditContext({ db: bindings.DB, approvalId });

  if (!approvalContext) {
    return NextResponse.json({ error: "Approval request not found" }, { status: 404 });
  }

  await approveRequest({
    db: bindings.DB,
    approvalId,
    approverUserId: parsed.data.approverUserId,
  });

  await insertAuditLog({
    db: bindings.DB,
    organizationId: approvalContext.organizationId,
    actorUserId: parsed.data.approverUserId,
    action: "approval.approved",
    targetType: "approval_request",
    targetId: approvalId,
    payload: JSON.stringify({
      journalEntryId: approvalContext.journalEntryId,
    }),
  });

  return NextResponse.json({ approved: true, approvalId });
}
