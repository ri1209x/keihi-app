import { NextResponse } from "next/server";
import { getRuntimeBindings } from "@/lib/cloudflare/context";
import { listRecentJournalEntries } from "@/lib/db/repository";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(limitRaw) ? limitRaw : 20;

  const bindings = await getRuntimeBindings();
  const items = await listRecentJournalEntries({ db: bindings.DB, limit });

  return NextResponse.json({ items });
}
