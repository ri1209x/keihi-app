import { NextResponse } from "next/server";
import { z } from "zod";
import { getRuntimeBindings } from "@/lib/cloudflare/context";
import { approveRequest } from "@/lib/db/repository";

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
  await approveRequest({
    db: bindings.DB,
    approvalId,
    approverUserId: parsed.data.approverUserId,
  });

  return NextResponse.json({ approved: true, approvalId });
}
