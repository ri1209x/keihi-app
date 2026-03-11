import { NextResponse } from "next/server";
import { z } from "zod";
import { getRuntimeBindings } from "@/lib/cloudflare/context";
import { createApprovalRequest } from "@/lib/db/repository";

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
  const approvalId = await createApprovalRequest({
    db: bindings.DB,
    journalEntryId: parsed.data.journalEntryId,
    requesterUserId: parsed.data.requesterUserId,
    approverUserId: parsed.data.approverUserId,
  });

  return NextResponse.json({ requested: true, approvalId });
}
