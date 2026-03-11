"use client";

import { useEffect, useState } from "react";

type ExtractionItem = {
  jobId: string;
  receiptId: string;
  status: string;
  attempts: number;
  provider: string;
  objectKey: string;
  createdAtEpoch: number;
  rawJson: string | null;
};

type ExtractionResponse = {
  items: ExtractionItem[];
};

function formatTimestamp(epochSec: number): string {
  if (!Number.isFinite(epochSec)) return "-";
  return new Date(epochSec * 1000).toLocaleString("ja-JP");
}

function summarizeJson(rawJson: string | null): string {
  if (!rawJson) return "未解析";
  try {
    const parsed = JSON.parse(rawJson) as {
      storeName?: string | null;
      issuedDate?: string | null;
      totalAmount?: number | null;
      confidence?: number | null;
    };
    return [
      parsed.storeName ? `店名:${parsed.storeName}` : null,
      parsed.totalAmount != null ? `金額:${parsed.totalAmount}` : null,
      parsed.issuedDate ? `日付:${parsed.issuedDate}` : null,
      parsed.confidence != null ? `信頼度:${parsed.confidence}` : null,
    ]
      .filter(Boolean)
      .join(" / ");
  } catch {
    return rawJson.slice(0, 120);
  }
}

export function ExtractionResultsClient() {
  const [items, setItems] = useState<ExtractionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setError(null);
      const res = await fetch("/api/extractions/recent?limit=20", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const json = (await res.json()) as ExtractionResponse;
      setItems(json.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      void load();
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  return (
    <section>
      <div className="row-between">
        <h2>解析結果確認</h2>
        <button type="button" onClick={() => void load()}>
          Reload
        </button>
      </div>
      {loading ? <p>読み込み中...</p> : null}
      {error ? <p className="error">エラー: {error}</p> : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>作成日時</th>
              <th>状態</th>
              <th>試行</th>
              <th>Receipt ID</th>
              <th>概要</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5}>データがありません</td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.jobId}>
                  <td>{formatTimestamp(item.createdAtEpoch)}</td>
                  <td>{item.status}</td>
                  <td>{item.attempts}</td>
                  <td className="mono">{item.receiptId}</td>
                  <td>{summarizeJson(item.rawJson)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
