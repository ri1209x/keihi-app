import { NextResponse } from "next/server";
import { UploadRequestSchema } from "@/features/upload-schema";
import { getRuntimeBindings } from "@/lib/cloudflare/context";
import { getTenantHeader } from "@/lib/cloudflare/request-context";
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
  const secret = bindings.UPLOAD_TOKEN_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "UPLOAD_TOKEN_SECRET is not configured" },
      { status: 500 },
    );
  }

  const tenantId = await getTenantHeader();
  const receiptId = crypto.randomUUID();
  const safeName = parsed.data.fileName.replace(/[^a-zA-Z0-9_.-]/g, "_");
  const objectKey = `${tenantId}/${receiptId}-${safeName}`;

  const token = await createUploadToken(
    {
      receiptId,
      objectKey,
      tenantId,
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
