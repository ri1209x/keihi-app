import { NextResponse } from "next/server";
import { getRuntimeBindings } from "@/lib/cloudflare/context";
import { getActorHeader } from "@/lib/cloudflare/request-context";
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
  const actorUserId = await getActorHeader();
  const items = await listApprovedJournalEntriesForExport({ db: bindings.DB });
  const fileDate = new Date().toISOString().slice(0, 10);
  const countsByOrganization = new Map<string, number>();

  for (const item of items) {
    countsByOrganization.set(item.organizationId, (countsByOrganization.get(item.organizationId) ?? 0) + 1);
  }

  await Promise.all(
    Array.from(countsByOrganization.entries()).map(([organizationId, count]) =>
      insertAuditLog({
        db: bindings.DB,
        organizationId,
        actorUserId,
        action: "journal.exported_csv",
        targetType: "journal_export",
        targetId: `journal-entries-${fileDate}.csv`,
        payload: JSON.stringify({ count }),
      }),
    ),
  );

  return new NextResponse(`\uFEFF${toCsv(items)}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="journal-entries-${fileDate}.csv"`,
      "cache-control": "no-store",
    },
  });
}
