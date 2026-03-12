import { NextResponse } from "next/server";
import { canAccessOrganization, getCurrentSession, hasRequiredRole } from "@/lib/auth/session";
import { getRuntimeBindings } from "@/lib/cloudflare/context";
import { insertAuditLog, insertUploadedReceipt } from "@/lib/db/repository";
import { verifyUploadToken } from "@/lib/security/upload-token";

const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ receiptId: string }> },
) {
  const { receiptId } = await params;
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
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

  const verified = await verifyUploadToken(token, secret);
  if (!verified || verified.receiptId !== receiptId || !canAccessOrganization(session, verified.tenantId)) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  if (!bindings.RECEIPTS_BUCKET) {
    return NextResponse.json(
      { error: "RECEIPTS_BUCKET binding is not available" },
      { status: 501 },
    );
  }

  const maxBytes = Number(bindings.MAX_UPLOAD_BYTES ?? DEFAULT_MAX_UPLOAD_BYTES);
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > maxBytes) {
    return NextResponse.json({ error: "File too large" }, { status: 413 });
  }

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > maxBytes) {
    return NextResponse.json({ error: "File too large" }, { status: 413 });
  }

  const contentType = request.headers.get("content-type") ?? "application/octet-stream";

  await bindings.RECEIPTS_BUCKET.put(verified.objectKey, bytes, {
    httpMetadata: {
      contentType,
    },
    customMetadata: {
      tenantId: verified.tenantId,
      clientId: verified.clientId,
      receiptId: verified.receiptId,
    },
  });

  await insertUploadedReceipt({
    db: bindings.DB,
    receiptId: verified.receiptId,
    tenantId: verified.tenantId,
    clientId: verified.clientId,
    objectKey: verified.objectKey,
  });

  await insertAuditLog({
    db: bindings.DB,
    organizationId: verified.tenantId,
    actorUserId: session.id,
    action: "receipt.uploaded",
    targetType: "receipt",
    targetId: verified.receiptId,
    payload: JSON.stringify({
      objectKey: verified.objectKey,
      clientId: verified.clientId,
      contentType,
      byteLength: bytes.byteLength,
    }),
  });

  return NextResponse.json({
    uploaded: true,
    receiptId: verified.receiptId,
    objectKey: verified.objectKey,
  });
}
