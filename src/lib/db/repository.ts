import type { ExtractionQueueMessage } from "@/types/queue/extraction";

export type RecentExtractionItem = {
  jobId: string;
  receiptId: string;
  status: string;
  attempts: number;
  provider: string;
  objectKey: string;
  createdAtEpoch: number;
  rawJson: string | null;
};

export type JournalSuggestionSource = {
  jobId: string;
  receiptId: string;
  organizationId: string;
  clientId: string;
  rawJson: string;
};

export type JournalEntryItem = {
  id: string;
  sourceJobId: string | null;
  status: string;
  eventDate: string;
  debitAccount: string | null;
  creditAccount: string | null;
  amount: number | null;
  taxCategory: string | null;
  memo: string | null;
  createdAtEpoch: number;
  approvalId: string | null;
  approvalStatus: string | null;
  approverUserId: string | null;
};

export type ExportJournalEntryItem = {
  id: string;
  approvalId: string | null;
  organizationId: string;
  clientId: string;
  receiptId: string | null;
  sourceJobId: string | null;
  eventDate: string;
  debitAccount: string | null;
  creditAccount: string | null;
  amount: number | null;
  taxCategory: string | null;
  memo: string | null;
  approvedAtEpoch: number | null;
};

export type JournalEntryAuditContext = {
  journalEntryId: string;
  organizationId: string;
  receiptId: string | null;
  sourceJobId: string | null;
};

export type ApprovalAuditContext = {
  approvalId: string;
  journalEntryId: string;
  organizationId: string;
};

export async function insertUploadedReceipt(params: {
  db?: D1Database;
  receiptId: string;
  tenantId: string;
  clientId: string;
  objectKey: string;
}): Promise<void> {
  if (!params.db) {
    return;
  }

  await params.db
    .prepare(
      `INSERT OR IGNORE INTO organizations (id, name)
       VALUES (?1, ?2)`,
    )
    .bind(params.tenantId, params.tenantId)
    .run();

  await params.db
    .prepare(
      `INSERT OR IGNORE INTO clients (id, organization_id, name)
       VALUES (?1, ?2, ?3)`,
    )
    .bind(params.clientId, params.tenantId, params.clientId)
    .run();

  await params.db
    .prepare(
      `INSERT OR REPLACE INTO receipts (id, organization_id, client_id, r2_key, status)
       VALUES (?1, ?2, ?3, ?4, 'uploaded')`,
    )
    .bind(params.receiptId, params.tenantId, params.clientId, params.objectKey)
    .run();
}

export async function insertExtractionJob(params: {
  db?: D1Database;
  message: ExtractionQueueMessage;
}): Promise<void> {
  if (!params.db) {
    return;
  }

  await params.db
    .prepare(
      `INSERT OR REPLACE INTO extraction_jobs (id, receipt_id, provider, status, attempts)
       VALUES (?1, ?2, ?3, 'queued', 0)`,
    )
    .bind(params.message.id, params.message.receiptId, params.message.provider)
    .run();
}

export async function completeExtractionJob(params: {
  db?: D1Database;
  jobId: string;
  receiptId: string;
  extractedJson: string;
}): Promise<void> {
  if (!params.db) {
    return;
  }

  await params.db
    .prepare(
      `INSERT OR REPLACE INTO extraction_results (id, receipt_id, raw_json)
       VALUES (?1, ?2, ?3)`,
    )
    .bind(params.jobId, params.receiptId, params.extractedJson)
    .run();

  await params.db
    .prepare("UPDATE extraction_jobs SET status = 'completed', attempts = attempts + 1 WHERE id = ?1")
    .bind(params.jobId)
    .run();
}

export async function failExtractionJob(params: {
  db?: D1Database;
  jobId: string;
}): Promise<void> {
  if (!params.db) {
    return;
  }

  await params.db
    .prepare("UPDATE extraction_jobs SET status = 'failed', attempts = attempts + 1 WHERE id = ?1")
    .bind(params.jobId)
    .run();
}

export async function listRecentExtractions(params: {
  db?: D1Database;
  limit?: number;
}): Promise<RecentExtractionItem[]> {
  if (!params.db) {
    return [];
  }

  const safeLimit = Math.min(Math.max(params.limit ?? 20, 1), 100);
  const result = await params.db
    .prepare(
      `SELECT
         j.id AS job_id,
         j.receipt_id,
         j.status,
         j.attempts,
         j.provider,
         r.r2_key,
         j.created_at,
         er.raw_json
       FROM extraction_jobs j
       LEFT JOIN receipts r ON r.id = j.receipt_id
       LEFT JOIN extraction_results er ON er.id = j.id
       ORDER BY j.created_at DESC
       LIMIT ?1`,
    )
    .bind(safeLimit)
    .all<{
      job_id: string;
      receipt_id: string;
      status: string;
      attempts: number;
      provider: string;
      r2_key: string;
      created_at: number;
      raw_json: string | null;
    }>();

  return (result.results ?? []).map((row) => ({
    jobId: row.job_id,
    receiptId: row.receipt_id,
    status: row.status,
    attempts: Number(row.attempts),
    provider: row.provider,
    objectKey: row.r2_key,
    createdAtEpoch: Number(row.created_at),
    rawJson: row.raw_json,
  }));
}

export async function getExtractionSourceByJobId(params: {
  db?: D1Database;
  jobId: string;
}): Promise<JournalSuggestionSource | null> {
  if (!params.db) {
    return null;
  }

  const row = await params.db
    .prepare(
      `SELECT
         j.id AS job_id,
         j.receipt_id,
         r.organization_id,
         r.client_id,
         er.raw_json
       FROM extraction_jobs j
       JOIN receipts r ON r.id = j.receipt_id
       JOIN extraction_results er ON er.id = j.id
       WHERE j.id = ?1
       LIMIT 1`,
    )
    .bind(params.jobId)
    .first<{
      job_id: string;
      receipt_id: string;
      organization_id: string;
      client_id: string;
      raw_json: string;
    }>();

  if (!row) {
    return null;
  }

  return {
    jobId: row.job_id,
    receiptId: row.receipt_id,
    organizationId: row.organization_id,
    clientId: row.client_id,
    rawJson: row.raw_json,
  };
}

export async function upsertJournalEntryFromSuggestion(params: {
  db?: D1Database;
  sourceJobId: string;
  receiptId: string;
  organizationId: string;
  clientId: string;
  eventDate: string;
  memo: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  taxCategory: string;
}): Promise<string> {
  if (!params.db) {
    return crypto.randomUUID();
  }

  const existing = await params.db
    .prepare("SELECT id FROM journal_entries WHERE source_job_id = ?1 LIMIT 1")
    .bind(params.sourceJobId)
    .first<{ id: string }>();

  const id = existing?.id ?? crypto.randomUUID();

  await params.db
    .prepare(
      `INSERT OR REPLACE INTO journal_entries (
        id, organization_id, client_id, receipt_id, source_job_id, status,
        event_date, memo, debit_account, credit_account, amount, tax_category
      ) VALUES (?1, ?2, ?3, ?4, ?5, 'draft', ?6, ?7, ?8, ?9, ?10, ?11)`,
    )
    .bind(
      id,
      params.organizationId,
      params.clientId,
      params.receiptId,
      params.sourceJobId,
      params.eventDate,
      params.memo,
      params.debitAccount,
      params.creditAccount,
      params.amount,
      params.taxCategory,
    )
    .run();

  return id;
}

export async function getJournalEntryAuditContext(params: {
  db?: D1Database;
  journalEntryId: string;
}): Promise<JournalEntryAuditContext | null> {
  if (!params.db) {
    return null;
  }

  const row = await params.db
    .prepare(
      `SELECT id, organization_id, receipt_id, source_job_id
       FROM journal_entries
       WHERE id = ?1
       LIMIT 1`,
    )
    .bind(params.journalEntryId)
    .first<{
      id: string;
      organization_id: string;
      receipt_id: string | null;
      source_job_id: string | null;
    }>();

  if (!row) {
    return null;
  }

  return {
    journalEntryId: row.id,
    organizationId: row.organization_id,
    receiptId: row.receipt_id,
    sourceJobId: row.source_job_id,
  };
}

export async function createApprovalRequest(params: {
  db?: D1Database;
  journalEntryId: string;
  requesterUserId: string;
  approverUserId?: string;
}): Promise<string> {
  if (!params.db) {
    return crypto.randomUUID();
  }

  const id = crypto.randomUUID();
  await params.db
    .prepare(
      `INSERT INTO approval_requests (id, journal_entry_id, requester_user_id, approver_user_id, status)
       VALUES (?1, ?2, ?3, ?4, 'pending')`,
    )
    .bind(id, params.journalEntryId, params.requesterUserId, params.approverUserId ?? null)
    .run();

  await params.db
    .prepare("UPDATE journal_entries SET status = 'pending_approval' WHERE id = ?1")
    .bind(params.journalEntryId)
    .run();

  return id;
}

export async function getApprovalAuditContext(params: {
  db?: D1Database;
  approvalId: string;
}): Promise<ApprovalAuditContext | null> {
  if (!params.db) {
    return null;
  }

  const row = await params.db
    .prepare(
      `SELECT
         a.id,
         a.journal_entry_id,
         j.organization_id
       FROM approval_requests a
       JOIN journal_entries j ON j.id = a.journal_entry_id
       WHERE a.id = ?1
       LIMIT 1`,
    )
    .bind(params.approvalId)
    .first<{
      id: string;
      journal_entry_id: string;
      organization_id: string;
    }>();

  if (!row) {
    return null;
  }

  return {
    approvalId: row.id,
    journalEntryId: row.journal_entry_id,
    organizationId: row.organization_id,
  };
}

export async function approveRequest(params: {
  db?: D1Database;
  approvalId: string;
  approverUserId: string;
}): Promise<void> {
  if (!params.db) {
    return;
  }

  await params.db
    .prepare(
      `UPDATE approval_requests
       SET status = 'approved', approver_user_id = ?2, approved_at = unixepoch()
       WHERE id = ?1`,
    )
    .bind(params.approvalId, params.approverUserId)
    .run();

  await params.db
    .prepare(
      `UPDATE journal_entries
       SET status = 'approved'
       WHERE id = (
         SELECT journal_entry_id FROM approval_requests WHERE id = ?1 LIMIT 1
       )`,
    )
    .bind(params.approvalId)
    .run();
}

export async function insertAuditLog(params: {
  db?: D1Database;
  organizationId: string;
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  payload?: string;
}): Promise<void> {
  if (!params.db) {
    return;
  }

  await params.db
    .prepare(
      `INSERT INTO audit_logs (id, organization_id, actor_user_id, action, target_type, target_id, payload)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    )
    .bind(
      crypto.randomUUID(),
      params.organizationId,
      params.actorUserId,
      params.action,
      params.targetType,
      params.targetId,
      params.payload ?? null,
    )
    .run();
}

export async function listRecentJournalEntries(params: {
  db?: D1Database;
  limit?: number;
}): Promise<JournalEntryItem[]> {
  if (!params.db) {
    return [];
  }

  const safeLimit = Math.min(Math.max(params.limit ?? 20, 1), 100);
  const result = await params.db
    .prepare(
      `SELECT
         j.id,
         j.source_job_id,
         j.status,
         j.event_date,
         j.debit_account,
         j.credit_account,
         j.amount,
         j.tax_category,
         j.memo,
         j.created_at,
         a.id AS approval_id,
         a.status AS approval_status,
         a.approver_user_id
       FROM journal_entries j
       LEFT JOIN approval_requests a ON a.journal_entry_id = j.id
       ORDER BY j.created_at DESC
       LIMIT ?1`,
    )
    .bind(safeLimit)
    .all<{
      id: string;
      source_job_id: string | null;
      status: string;
      event_date: string;
      debit_account: string | null;
      credit_account: string | null;
      amount: number | null;
      tax_category: string | null;
      memo: string | null;
      created_at: number;
      approval_id: string | null;
      approval_status: string | null;
      approver_user_id: string | null;
    }>();

  return (result.results ?? []).map((row) => ({
    id: row.id,
    sourceJobId: row.source_job_id,
    status: row.status,
    eventDate: row.event_date,
    debitAccount: row.debit_account,
    creditAccount: row.credit_account,
    amount: row.amount == null ? null : Number(row.amount),
    taxCategory: row.tax_category,
    memo: row.memo,
    createdAtEpoch: Number(row.created_at),
    approvalId: row.approval_id,
    approvalStatus: row.approval_status,
    approverUserId: row.approver_user_id,
  }));
}

export async function listApprovedJournalEntriesForExport(params: {
  db?: D1Database;
  organizationId?: string;
}): Promise<ExportJournalEntryItem[]> {
  if (!params.db) {
    return [];
  }

  const baseSql = `SELECT
      j.id,
      j.organization_id,
      j.client_id,
      j.receipt_id,
      j.source_job_id,
      j.event_date,
      j.debit_account,
      j.credit_account,
      j.amount,
      j.tax_category,
      j.memo,
      a.id AS approval_id,
      a.approved_at
    FROM journal_entries j
    LEFT JOIN approval_requests a ON a.journal_entry_id = j.id
    WHERE j.status = 'approved'`;

  const statement = params.organizationId
    ? params.db.prepare(`${baseSql} AND j.organization_id = ?1 ORDER BY COALESCE(a.approved_at, j.created_at) DESC, j.created_at DESC`).bind(params.organizationId)
    : params.db.prepare(`${baseSql} ORDER BY COALESCE(a.approved_at, j.created_at) DESC, j.created_at DESC`);

  const result = await statement.all<{
    id: string;
    organization_id: string;
    client_id: string;
    receipt_id: string | null;
    source_job_id: string | null;
    event_date: string;
    debit_account: string | null;
    credit_account: string | null;
    amount: number | null;
    tax_category: string | null;
    memo: string | null;
    approval_id: string | null;
    approved_at: number | null;
  }>();

  return (result.results ?? []).map((row) => ({
    id: row.id,
    approvalId: row.approval_id,
    organizationId: row.organization_id,
    clientId: row.client_id,
    receiptId: row.receipt_id,
    sourceJobId: row.source_job_id,
    eventDate: row.event_date,
    debitAccount: row.debit_account,
    creditAccount: row.credit_account,
    amount: row.amount == null ? null : Number(row.amount),
    taxCategory: row.tax_category,
    memo: row.memo,
    approvedAtEpoch: row.approved_at == null ? null : Number(row.approved_at),
  }));
}
