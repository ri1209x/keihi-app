import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { getRuntimeBindings } from "@/lib/cloudflare/context";
import { insertAuditLog, listApprovedJournalEntriesForExport } from "@/lib/db/repository";

function escapeCsvCell(value: string | number | null): string {
  if (value == null) {
    return "";
  }

  const text = String(value);
  if (!/[",\r\n]/.test(text)) {
    return text;
  }

  return `"${text.replaceAll('"', '""')}"`;
}

function toCsv(items: Awaited<ReturnType<typeof listApprovedJournalEntriesForExport>>): string {
  const header = [
    "journal_id",
    "approval_id",
    "organization_id",
    "client_id",
    "receipt_id",
    "source_job_id",
    "event_date",
    "debit_account",
    "credit_account",
    "amount",
    "tax_category",
    "memo",
    "approved_at",
  ];

  const rows = items.map((item) => [
    item.id,
    item.approvalId,
    item.organizationId,
    item.clientId,
    item.receiptId,
    item.sourceJobId,
    item.eventDate,
    item.debitAccount,
    item.creditAccount,
    item.amount,
    item.taxCategory,
    item.memo,
    item.approvedAtEpoch == null ? null : new Date(item.approvedAtEpoch * 1000).toISOString(),
  ]);

  return [header, ...rows].map((row) => row.map((cell) => escapeCsvCell(cell)).join(",")).join("\r\n");
}

export async function GET() {
  const bindings = await getRuntimeBindings();
  const session = await getCurrentSession(bindings);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await listApprovedJournalEntriesForExport({
    db: bindings.DB,
    organizationId: session.organizationId,
  });
  const fileDate = new Date().toISOString().slice(0, 10);

  await insertAuditLog({
    db: bindings.DB,
    organizationId: session.organizationId,
    actorUserId: session.id,
    action: "journal.exported_csv",
    targetType: "journal_export",
    targetId: `journal-entries-${fileDate}.csv`,
    payload: JSON.stringify({ count: items.length }),
  });

  return new NextResponse(`\uFEFF${toCsv(items)}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="journal-entries-${fileDate}.csv"`,
      "cache-control": "no-store",
    },
  });
}
