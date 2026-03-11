"use client";

import { useState } from "react";

type UploadStep = "idle" | "issuing-url" | "uploading" | "queueing" | "done" | "error";

export function ReceiptUploadClient() {
  const [clientId, setClientId] = useState("demo-client");
  const [tenantId, setTenantId] = useState("demo-tenant");
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<UploadStep>("idle");
  const [message, setMessage] = useState("未実行");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!file) {
      setStep("error");
      setMessage("ファイルを選択してください。");
      return;
    }

    try {
      setStep("issuing-url");
      setMessage("アップロードURLを発行しています...");

      const initRes = await fetch("/api/receipts/upload", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({
          clientId,
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          contentLength: file.size,
        }),
      });

      if (!initRes.ok) {
        throw new Error(await initRes.text());
      }

      const initJson = (await initRes.json()) as {
        receiptId: string;
        objectKey: string;
        uploadUrl: string;
      };

      setStep("uploading");
      setMessage("R2へアップロードしています...");

      const uploadRes = await fetch(initJson.uploadUrl, {
        method: "PUT",
        headers: {
          "content-type": file.type || "application/octet-stream",
        },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error(await uploadRes.text());
      }

      setStep("queueing");
      setMessage("解析キューに投入しています...");

      const enqueueRes = await fetch("/api/receipts/enqueue", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-tenant-id": tenantId,
        },
        body: JSON.stringify({
          receiptId: initJson.receiptId,
          objectKey: initJson.objectKey,
          clientId,
          provider: "gemini-2.5-flash",
        }),
      });

      if (!enqueueRes.ok) {
        throw new Error(await enqueueRes.text());
      }

      setStep("done");
      setMessage(`完了: receiptId=${initJson.receiptId}`);
    } catch (error) {
      const text = error instanceof Error ? error.message : "unknown error";
      setStep("error");
      setMessage(`失敗: ${text}`);
    }
  }

  return (
    <section>
      <h2>レシートアップロード</h2>
      <form onSubmit={onSubmit} className="stack">
        <label>
          Tenant ID
          <input value={tenantId} onChange={(e) => setTenantId(e.target.value)} />
        </label>
        <label>
          Client ID
          <input value={clientId} onChange={(e) => setClientId(e.target.value)} />
        </label>
        <label>
          Receipt file
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <button type="submit" disabled={step === "issuing-url" || step === "uploading" || step === "queueing"}>
          Upload and Enqueue
        </button>
      </form>
      <p>Status: {step}</p>
      <p>{message}</p>
    </section>
  );
}
