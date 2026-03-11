ALTER TABLE journal_entries ADD COLUMN source_job_id TEXT;
ALTER TABLE journal_entries ADD COLUMN debit_account TEXT;
ALTER TABLE journal_entries ADD COLUMN credit_account TEXT;
ALTER TABLE journal_entries ADD COLUMN amount REAL;
ALTER TABLE journal_entries ADD COLUMN tax_category TEXT;

CREATE INDEX IF NOT EXISTS idx_journal_entries_source_job_id ON journal_entries(source_job_id);
