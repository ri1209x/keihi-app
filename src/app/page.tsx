import { getCurrentSession } from "@/lib/auth/session";
import { getRuntimeBindings } from "@/lib/cloudflare/context";
import { getExecutionEnvironment } from "@/lib/cloudflare/env";
import { AuthSessionClient } from "@/features/auth-session-client";
import { ReceiptUploadClient } from "@/features/receipt-upload-client";
import { ExtractionResultsClient } from "@/features/extraction-results-client";
import { JournalWorkflowClient } from "@/features/journal-workflow-client";

const tasks = [
  { id: "T-001", name: "Cloudflare基盤", status: "Done" },
  { id: "T-002", name: "D1初版スキーマ", status: "Done" },
  { id: "T-003", name: "R2アップロードAPI", status: "Done" },
  { id: "T-004", name: "Queue解析ワーカー", status: "Done" },
  { id: "T-005", name: "Gemini連携", status: "Done" },
  { id: "T-006", name: "解析結果確認UI", status: "Done" },
  { id: "T-007", name: "仕訳候補生成 + 承認フロー", status: "Done" },
  { id: "T-008", name: "CSVエクスポート", status: "Done" },
  { id: "T-009", name: "監査ログ記録", status: "Done" },
  { id: "T-010", name: "認証/認可", status: "Done" },
];

export default async function HomePage() {
  const env = getExecutionEnvironment();
  const bindings = await getRuntimeBindings();
  const session = await getCurrentSession(bindings);

  return (
    <main className="container">
      <h1>Keihi Keisan App</h1>
      <p>Cloudflare前提のMVP基盤を実装中です。</p>
      <p>Runtime: {env.runtime}</p>
      <section>
        <h2>優先タスク</h2>
        <ul>
          {tasks.map((task) => (
            <li key={task.id}>
              {task.id}: {task.name} ({task.status})
            </li>
          ))}
        </ul>
      </section>
      <AuthSessionClient />
      {session ? (
        <>
          <ReceiptUploadClient
            canUpload={session.role === "operator" || session.role === "admin"}
            defaultClientId={session.defaultClientId}
            organizationId={session.organizationId}
          />
          <ExtractionResultsClient />
          <JournalWorkflowClient role={session.role} />
        </>
      ) : (
        <section>
          <h2>ログインが必要です</h2>
          <p>上のデモユーザーでログインすると、組織とロールに応じた画面/API を利用できます。</p>
        </section>
      )}
    </main>
  );
}
