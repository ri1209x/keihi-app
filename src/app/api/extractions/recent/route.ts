import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { getRuntimeBindings } from "@/lib/cloudflare/context";
import { listRecentExtractions } from "@/lib/db/repository";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(limitRaw) ? limitRaw : 20;

  const bindings = await getRuntimeBindings();
  const session = await getCurrentSession(bindings);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await listRecentExtractions({
    db: bindings.DB,
    limit,
    organizationId: session.organizationId,
  });

  return NextResponse.json({ items });
}
