# Keihi Keisan App

Cloudflare 前提の経費計算・仕訳申請アプリの実装リポジトリ。

## Setup

1. `./.tools/node-v20.19.0-win-x64/npm.cmd install`
2. `.env.local.example` を参考に `.env.local` を作成
3. `./.tools/node-v20.19.0-win-x64/npm.cmd run dev`
4. 画面上部のデモユーザーでログインしてから操作する

## Cloudflare Secrets

本番/ステージングでは以下を `wrangler secret put` で設定する。

- `AUTH_SESSION_SECRET`
- `UPLOAD_TOKEN_SECRET`
- `GEMINI_API_KEY`

## Current API Flow

1. `POST /api/auth/session` でデモセッションを作成
2. `POST /api/receipts/upload`
3. 返却された `uploadUrl` に対して `PUT` で画像を送信
4. `POST /api/receipts/enqueue` で解析キューに投入
5. Queue consumer が R2 -> Gemini -> D1(`extraction_results`) に保存
6. `POST /api/journals/suggest` で仕訳候補を作成
7. `POST /api/approvals/request` -> `POST /api/approvals/[approvalId]/approve` で承認
8. `GET /api/exports/journals` で承認済み仕訳をCSV出力

## Scripts

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test:e2e`
- `npm run cf:build`
- `npm run cf:deploy:web`
- `npm run cf:deploy:consumer`

## Migration

追加 migration:

- `drizzle/migrations/0001_journal_columns.sql`

本番反映:

```powershell
npx wrangler d1 execute keihi-prod --remote --file=./drizzle/migrations/0001_journal_columns.sql -c wrangler.jsonc
```

## Docs

- `docs/cloudflare-technical-stack.md`
- `docs/implementation-plan.md`
