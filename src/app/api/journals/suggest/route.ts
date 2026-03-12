import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession, hasRequiredRole } from "@/lib/auth/session";
import { getRuntimeBindings } from "@/lib/cloudflare/context";
import {
  getExtractionSourceByJobId,
  insertAuditLog,
  upsertJournalEntryFromSuggestion,
} from "@/lib/db/repository";

const SuggestSchema = z.object({
  jobId: z.string().min(1),
});

type ExtractedShape = {
  storeName?: string | null;
  issuedDate?: string | null;
  totalAmount?: number | null;
  paymentMethod?: string | null;
  summary?: string | null;
  taxRate?: number | null;
};

function pickDebitAccount(summary: string): string {
  if (/交通|電車|バス|タクシー/.test(summary)) return "旅費交通費";
  if (/食|飲|弁当|ランチ|夕食/.test(summary)) return "会議費";
  if (/水|文具|日用品|消耗/.test(summary)) return "消耗品費";
  return "雑費";
}

function pickCreditAccount(paymentMethod: string): string {
  if (/paypay|カード|credit|visa|master|jcb/i.test(paymentMethod)) return "未払金";
  return "現金";
}

function pickTaxCategory(taxRate?: number | null): string {
  if (taxRate == null) return "対象外";
  if (taxRate >= 0.099) return "課税10%";
  if (taxRate >= 0.079) return "軽減8%";
  return "対象外";
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = SuggestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 });
  }

  const bindings = await getRuntimeBindings();
  const session = await getCurrentSession(bindings);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasRequiredRole(session.role, ["operator"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const source = await getExtractionSourceByJobId({
    db: bindings.DB,
    jobId: parsed.data.jobId,
    organizationId: session.organizationId,
  });
  if (!source) {
    return NextResponse.json({ error: "Extraction result not found" }, { status: 404 });
  }

  const extracted = JSON.parse(source.rawJson) as ExtractedShape;
  const summary = extracted.summary ?? "レシート経費";
  const paymentMethod = extracted.paymentMethod ?? "cash";
  const amount = extracted.totalAmount ?? 0;
  const eventDate = extracted.issuedDate ? extracted.issuedDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const debitAccount = pickDebitAccount(summary);
  const creditAccount = pickCreditAccount(paymentMethod);
  const taxCategory = pickTaxCategory(extracted.taxRate);

  const journalEntryId = await upsertJournalEntryFromSuggestion({
    db: bindings.DB,
    sourceJobId: source.jobId,
    receiptId: source.receiptId,
    organizationId: source.organizationId,
    clientId: source.clientId,
    eventDate,
    memo: summary,
    debitAccount,
    creditAccount,
    amount,
    taxCategory,
  });

  await insertAuditLog({
    db: bindings.DB,
    organizationId: source.organizationId,
    actorUserId: session.id,
    action: "journal.suggested",
    targetType: "journal_entry",
    targetId: journalEntryId,
    payload: JSON.stringify({
      sourceJobId: source.jobId,
      receiptId: source.receiptId,
      debitAccount,
      creditAccount,
      amount,
      taxCategory,
    }),
  });

  return NextResponse.json({
    suggested: true,
    journalEntryId,
  });
}
