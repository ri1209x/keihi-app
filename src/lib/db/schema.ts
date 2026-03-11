import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const clients = sqliteTable("clients", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  taxPayerId: text("tax_payer_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const receipts = sqliteTable("receipts", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  clientId: text("client_id").notNull().references(() => clients.id),
  r2Key: text("r2_key").notNull(),
  status: text("status").notNull().default("uploaded"),
  uploadedAt: integer("uploaded_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const extractionJobs = sqliteTable("extraction_jobs", {
  id: text("id").primaryKey(),
  receiptId: text("receipt_id").notNull().references(() => receipts.id),
  provider: text("provider").notNull().default("gemini-2.5-flash"),
  status: text("status").notNull().default("queued"),
  attempts: integer("attempts").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const extractionResults = sqliteTable("extraction_results", {
  id: text("id").primaryKey(),
  receiptId: text("receipt_id").notNull().references(() => receipts.id),
  rawJson: text("raw_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const journalEntries = sqliteTable("journal_entries", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  clientId: text("client_id").notNull().references(() => clients.id),
  receiptId: text("receipt_id").references(() => receipts.id),
  status: text("status").notNull().default("draft"),
  eventDate: text("event_date").notNull(),
  memo: text("memo"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const approvalRequests = sqliteTable("approval_requests", {
  id: text("id").primaryKey(),
  journalEntryId: text("journal_entry_id").notNull().references(() => journalEntries.id),
  requesterUserId: text("requester_user_id").notNull(),
  approverUserId: text("approver_user_id"),
  status: text("status").notNull().default("pending"),
  requestedAt: integer("requested_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  approvedAt: integer("approved_at", { mode: "timestamp" }),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  actorUserId: text("actor_user_id").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  payload: text("payload"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});
