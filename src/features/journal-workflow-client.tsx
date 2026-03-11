"use client";

import { useEffect, useState } from "react";

type JournalItem = {
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

type JournalResponse = {
  items: JournalItem[];
};

type ExtractionItem = {
  jobId: string;
  receiptId: string;
  status: string;
  rawJson: string | null;
};

type ExtractionResponse = {
  items: ExtractionItem[];
};

function fmtDate(epochSec: number): string {
  return new Date(epochSec * 1000).toLocaleString("ja-JP");
}

export function JournalWorkflowClient() {
  const [journals, setJournals] = useState<JournalItem[]>([]);
  const [completedJobs, setCompletedJobs] = useState<ExtractionItem[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("未実行");

  async function loadAll() {
    const [jRes, eRes] = await Promise.all([
      fetch("/api/journals/recent?limit=20", { cache: "no-store" }),
      fetch("/api/extractions/recent?limit=20", { cache: "no-store" }),
    ]);

    if (!jRes.ok) {
      throw new Error(await jRes.text());
    }
    if (!eRes.ok) {
      throw new Error(await eRes.text());
    }

    const jJson = (await jRes.json()) as JournalResponse;
    const eJson = (await eRes.json()) as ExtractionResponse;

    setJournals(jJson.items ?? []);
    setCompletedJobs((eJson.items ?? []).filter((x) => x.status === "completed"));
  }

  useEffect(() => {
    void loadAll();
  }, []);

  async function createSuggestion(jobId: string) {
    try {
      setBusy(jobId);
      const res = await fetch("/api/journals/suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      if (!res.ok) throw new Error(await res.text());
      setMessage(`仕訳候補を作成しました: jobId=${jobId}`);
      await loadAll();
    } catch (e) {
      setMessage(`仕訳候補作成に失敗: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  async function requestApproval(journalEntryId: string) {
    try {
      setBusy(journalEntryId);
      const res = await fetch("/api/approvals/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          journalEntryId,
          requesterUserId: "operator",
          approverUserId: "approver",
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setMessage(`承認申請を作成しました: journalEntryId=${journalEntryId}`);
      await loadAll();
    } catch (e) {
      setMessage(`承認申請に失敗: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  async function approve(approvalId: string) {
    try {
      setBusy(approvalId);
      const res = await fetch(`/api/approvals/${approvalId}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ approverUserId: "approver" }),
      });
      if (!res.ok) throw new Error(await res.text());
      setMessage(`承認しました: approvalId=${approvalId}`);
      await loadAll();
    } catch (e) {
      setMessage(`承認に失敗: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section>
      <div className="row-between">
        <h2>仕訳候補と承認</h2>
        <button type="button" onClick={() => void loadAll()}>
          Reload
        </button>
      </div>

      <p>{message}</p>

      <h3>仕訳候補未作成の解析ジョブ</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Job ID</th>
              <th>Receipt ID</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {completedJobs.length === 0 ? (
              <tr>
                <td colSpan={3}>completed ジョブはありません</td>
              </tr>
            ) : (
              completedJobs.map((job) => (
                <tr key={job.jobId}>
                  <td className="mono">{job.jobId}</td>
                  <td className="mono">{job.receiptId}</td>
                  <td>
                    <button type="button" disabled={busy === job.jobId} onClick={() => void createSuggestion(job.jobId)}>
                      仕訳候補作成
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h3>仕訳一覧</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>作成日時</th>
              <th>状態</th>
              <th>日付</th>
              <th>借方/貸方</th>
              <th>金額</th>
              <th>税区分</th>
              <th>摘要</th>
              <th>承認</th>
            </tr>
          </thead>
          <tbody>
            {journals.length === 0 ? (
              <tr>
                <td colSpan={8}>仕訳データがありません</td>
              </tr>
            ) : (
              journals.map((j) => (
                <tr key={j.id}>
                  <td>{fmtDate(j.createdAtEpoch)}</td>
                  <td>{j.status}</td>
                  <td>{j.eventDate}</td>
                  <td>{`${j.debitAccount ?? "-"} / ${j.creditAccount ?? "-"}`}</td>
                  <td>{j.amount ?? "-"}</td>
                  <td>{j.taxCategory ?? "-"}</td>
                  <td>{j.memo ?? "-"}</td>
                  <td>
                    {j.approvalId ? (
                      j.approvalStatus === "approved" ? (
                        <span>承認済み</span>
                      ) : (
                        <button type="button" disabled={busy === j.approvalId} onClick={() => void approve(j.approvalId!)}>
                          承認
                        </button>
                      )
                    ) : (
                      <button type="button" disabled={busy === j.id} onClick={() => void requestApproval(j.id)}>
                        承認申請
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
