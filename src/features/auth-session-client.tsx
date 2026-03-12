"use client";

import { useEffect, useState } from "react";
import type { DemoUser } from "@/lib/auth/demo-users";

type SessionResponse = {
  session: DemoUser | null;
  users: DemoUser[];
};

export function AuthSessionClient() {
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [session, setSession] = useState<DemoUser | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("operator");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("認証状態を読み込み中...");

  async function load() {
    const res = await fetch("/api/auth/session", { cache: "no-store" });
    if (!res.ok) {
      throw new Error(await res.text());
    }

    const json = (await res.json()) as SessionResponse;
    setUsers(json.users ?? []);
    setSession(json.session ?? null);
    setSelectedUserId(json.session?.id ?? json.users?.[0]?.id ?? "operator");
    setMessage(json.session ? `ログイン中: ${json.session.displayName}` : "未ログイン");
  }

  useEffect(() => {
    void load();
  }, []);

  async function signIn() {
    try {
      setBusy(true);
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId }),
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      window.location.reload();
    } catch (error) {
      setMessage(`ログイン失敗: ${error instanceof Error ? error.message : String(error)}`);
      setBusy(false);
    }
  }

  async function signOut() {
    try {
      setBusy(true);
      const res = await fetch("/api/auth/session", { method: "DELETE" });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      window.location.reload();
    } catch (error) {
      setMessage(`ログアウト失敗: ${error instanceof Error ? error.message : String(error)}`);
      setBusy(false);
    }
  }

  return (
    <section>
      <div className="row-between">
        <h2>認証セッション</h2>
        {session ? (
          <button type="button" onClick={() => void signOut()} disabled={busy}>
            ログアウト
          </button>
        ) : null}
      </div>
      <p>{message}</p>
      <p>デモ用ユーザーを選択すると、テナント境界とロール権限を cookie ベースで切り替えます。</p>
      <div className="stack auth-grid">
        <label>
          デモユーザー
          <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} disabled={busy}>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName} / {user.organizationId} / {user.role}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => void signIn()} disabled={busy || users.length === 0}>
          このユーザーでログイン
        </button>
      </div>
      {session ? (
        <p>
          現在の権限: <strong>{session.role}</strong> / 組織: <span className="mono">{session.organizationId}</span>
        </p>
      ) : null}
    </section>
  );
}
