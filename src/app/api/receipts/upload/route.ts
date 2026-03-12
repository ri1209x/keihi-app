import { NextResponse } from "next/server";
import { hasRequiredRole, getCurrentSession } from "@/lib/auth/session";
import { UploadRequestSchema } from "@/features/upload-schema";
import { getRuntimeBindings } from "@/lib/cloudflare/context";
import { createUploadToken } from "@/lib/security/upload-token";

const TOKEN_TTL_MS = 5 * 60 * 1000;

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = UploadRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const bindings = await getRuntimeBindings();
  const session = await getCurrentSession(bindings);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasRequiredRole(session.role, ["operator"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const secret = bindings.UPLOAD_TOKEN_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "UPLOAD_TOKEN_SECRET is not configured" },
      { status: 500 },
    );
  }

  const receiptId = crypto.randomUUID();
  const safeName = parsed.data.fileName.replace(/[^a-zA-Z0-9_.-]/g, "_");
  const objectKey = `${session.organizationId}/${receiptId}-${safeName}`;

  const token = await createUploadToken(
    {
      receiptId,
      objectKey,
      tenantId: session.organizationId,
      clientId: parsed.data.clientId,
      exp: Date.now() + TOKEN_TTL_MS,
    },
    secret,
  );

  return NextResponse.json({
    receiptId,
    objectKey,
    uploadMethod: "PUT",
    uploadUrl: `/api/receipts/upload/${receiptId}?token=${encodeURIComponent(token)}`,
    expiresInSec: TOKEN_TTL_MS / 1000,
  });
}
