import { NextResponse } from "next/server";
import { getCurrentSession, hasRequiredRole } from "@/lib/auth/session";
import { z } from "zod";
import { getRuntimeBindings } from "@/lib/cloudflare/context";
import { approveRequest, getApprovalAuditContext, insertAuditLog } from "@/lib/db/repository";

const ApproveSchema = z.object({
  approverUserId: z.string().min(1).optional(),
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
  const session = await getCurrentSession(bindings);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasRequiredRole(session.role, ["approver"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const approvalContext = await getApprovalAuditContext({
    db: bindings.DB,
    approvalId,
    organizationId: session.organizationId,
  });

  if (!approvalContext) {
    return NextResponse.json({ error: "Approval request not found" }, { status: 404 });
  }

  await approveRequest({
    db: bindings.DB,
    approvalId,
    approverUserId: session.id,
  });

  await insertAuditLog({
    db: bindings.DB,
    organizationId: approvalContext.organizationId,
    actorUserId: session.id,
    action: "approval.approved",
    targetType: "approval_request",
    targetId: approvalId,
    payload: JSON.stringify({
      journalEntryId: approvalContext.journalEntryId,
      requestedApproverUserId: parsed.data.approverUserId ?? null,
    }),
  });

  return NextResponse.json({ approved: true, approvalId });
}
