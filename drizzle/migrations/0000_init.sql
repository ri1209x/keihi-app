CREATE TABLE organizations (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE clients (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  tax_payer_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE receipts (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  client_id TEXT NOT NULL REFERENCES clients(id),
  r2_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploaded',
  uploaded_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE extraction_jobs (
  id TEXT PRIMARY KEY NOT NULL,
  receipt_id TEXT NOT NULL REFERENCES receipts(id),
  provider TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
  status TEXT NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE extraction_results (
  id TEXT PRIMARY KEY NOT NULL,
  receipt_id TEXT NOT NULL REFERENCES receipts(id),
  raw_json TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE journal_entries (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  client_id TEXT NOT NULL REFERENCES clients(id),
  receipt_id TEXT REFERENCES receipts(id),
  status TEXT NOT NULL DEFAULT 'draft',
  event_date TEXT NOT NULL,
  memo TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE approval_requests (
  id TEXT PRIMARY KEY NOT NULL,
  journal_entry_id TEXT NOT NULL REFERENCES journal_entries(id),
  requester_user_id TEXT NOT NULL,
  approver_user_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at INTEGER NOT NULL DEFAULT (unixepoch()),
  approved_at INTEGER
);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  actor_user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  payload TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_clients_organization_id ON clients(organization_id);
CREATE INDEX idx_receipts_client_id ON receipts(client_id);
CREATE INDEX idx_extraction_jobs_receipt_id ON extraction_jobs(receipt_id);
CREATE INDEX idx_extraction_results_receipt_id ON extraction_results(receipt_id);
CREATE INDEX idx_journal_entries_client_id ON journal_entries(client_id);
CREATE INDEX idx_approval_requests_journal_entry_id ON approval_requests(journal_entry_id);
CREATE INDEX idx_audit_logs_organization_id ON audit_logs(organization_id);
