# Cloudflare前提の技術スタックと開発フロー

## 1. 前提

- 対象プロダクト: 経費計算・仕訳申請アプリ
- 主要利用者: 税理士事務所スタッフ、個人事業主
- 主要ユースケース: レシート撮影、AI抽出、仕訳候補生成、確認承認、CSV/会計連携
- 実行基盤: Cloudflare
- 画像判定: `gemini-2.5-flash`

このドキュメントでは、Cloudflare上で無理なく運用できることを最優先に、MVPから本番運用まで見据えた技術スタックを選定する。

## 2. 採用技術スタック

### 2.1 アプリケーション

- フロントエンド: `Next.js 16` + `React` + `TypeScript`
- ルーティング: `App Router`
- 実行方式: `Cloudflare Workers` 上で `@opennextjs/cloudflare` を利用
- スタイリング: `Tailwind CSS`
- UI部品: `shadcn/ui`
- 入力/検証: `React Hook Form` + `Zod`

### 2.2 バックエンド

- BFF/API: `Next.js Route Handlers` と `Server Actions`
- 認証: `Auth.js` を第一候補
- ORM/SQL: `Drizzle ORM`
- バリデーション: `Zod`
- 非同期処理: `Cloudflare Queues`

### 2.3 データストア

- メインDB: `Cloudflare D1`
- ファイル保存: `Cloudflare R2`
- キャッシュ/軽量設定: `Cloudflare KV`
- 監査・実行ログ: `D1` を正本、必要に応じて `R2` に長期アーカイブ

### 2.4 AI連携

- 推論モデル: `gemini-2.5-flash`
- AIプロキシ: `Cloudflare AI Gateway`
- 送信方式: サーバー側から Gateway 経由で Gemini を呼び出す

### 2.5 監視・運用

- デプロイ/設定: `Wrangler`
- CI/CD: `GitHub Actions`
- 監視: `Cloudflare Observability`
- プロダクト分析: `Cloudflare Web Analytics`
- エラー監視: `Sentry` を任意追加

## 3. 選定理由

### 3.1 Next.js 16 + App Router

- 管理画面、アップロード画面、承認画面を同一アプリで構築しやすい
- Server Components と Server Actions により、入力フォームと一覧画面を比較的薄い実装でまとめやすい
- Cloudflare の公式ドキュメントでは Next.js を Workers 上へ `OpenNext` アダプタ経由でデプロイできる

補足:
- `@opennextjs/cloudflare` は Cloudflare の推奨ルートだが、現時点でもアダプタ由来の制約確認は必要
- Node.js runtime 前提で設計し、Edge runtime 専用実装には寄せない

### 3.2 Cloudflare Workers

- 日本を含むグローバル低遅延配信に向く
- Next.js のフロントと API を同一基盤で運用できる
- R2 / D1 / Queues / AI Gateway と binding で密結合でき、インフラ構成が単純になる

### 3.3 D1

- MVPの帳票系・業務系データには十分なリレーショナル構造を持てる
- 顧問先単位、事務所単位のデータ分離設計をしやすい
- Workers から binding 経由で扱えるため接続管理が軽い

採用判断:
- 初期は `D1` を採用する
- 高度な分析や複雑な集計が増え、D1の制約が運用上の問題になる段階で `Hyperdrive + Postgres` への拡張を検討する

### 3.4 R2

- レシート画像、PDF、OCR元ファイル、AI抽出JSONの保管先として適切
- egressコスト設計が比較的有利
- Workers binding と相性が良い

### 3.5 Queues

- 画像アップロード直後の重い処理を同期レスポンスから切り離せる
- レシート解析、再解析、会計連携をジョブ化できる
- 再試行、DLQ 前提の設計にしやすい

### 3.6 AI Gateway + Gemini

- Gemini APIキーをクライアントに出さずに済む
- AIリクエストのログ、レート制御、将来的なフォールバック制御をまとめられる
- 将来 `gemini-2.5-flash` から別モデルへ切り替える時のアプリ変更を小さくできる

## 4. 採用しないもの

- `next-on-pages`
  - Edge runtime 制約が強く、今回の業務アプリには不向き

- 初期段階でのマイクロサービス分割
  - 早すぎる分割で運用コストが上がる
  - MVPは単一 Next.js アプリ + Queue consumer で十分

- 初期段階での Durable Objects 中心設計
  - リアルタイム共同編集が主目的ではない
  - 仕訳承認や証憑管理の正本は RDB が自然

## 5. 推奨システム構成

### 5.1 論理構成

1. ユーザーが Next.js 画面からレシート画像をアップロードする
2. アプリが署名付きアップロードまたは Worker 経由で `R2` に保存する
3. 保存完了後、`Queues` に解析ジョブを投入する
4. Queue consumer が画像と補助情報を取得する
5. consumer が `AI Gateway` 経由で `gemini-2.5-flash` を呼び、抽出JSONを生成する
6. 結果を `D1` に保存し、画像メタデータやAIレスポンス要約を紐付ける
7. ユーザーは候補仕訳を確認・修正・承認する
8. 承認後、CSV出力または外部会計ソフト連携ジョブを起動する

### 5.2 Cloudflareサービス対応表

| 領域 | 採用 | 用途 |
|---|---|---|
| Webアプリ | Workers + OpenNext | Next.js 実行基盤 |
| DB | D1 | ユーザー、証憑、仕訳、承認、監査ログ |
| ファイル | R2 | レシート画像、PDF、AI抽出JSON |
| 非同期処理 | Queues | OCR/AI解析、再試行、連携 |
| AI制御 | AI Gateway | Gemini呼び出し、ログ、レート制御 |
| 設定/キャッシュ | KV | テナント設定キャッシュ、軽量フラグ |
| 監視 | Observability | 実行ログ、エラー、パフォーマンス |

## 6. データモデリング方針

### 6.1 D1に置くデータ

- users
- organizations
- clients
- memberships
- receipts
- receipt_files
- extraction_jobs
- extraction_results
- journal_entries
- journal_entry_lines
- approval_requests
- correction_logs
- export_jobs
- audit_logs

### 6.2 R2に置くデータ

- オリジナル画像
- 圧縮画像
- PDF
- AI抽出の原本JSON
- エクスポート生成物

### 6.3 KVに置くデータ

- 顧問先ごとの軽量設定キャッシュ
- 科目推定ルールのキャッシュ
- 一時的なレート制御キー

## 7. アプリケーション設計方針

### 7.1 Next.js レイヤ分割

- `app/`: 画面とレイアウト
- `app/api/`: Webhook、アップロード、外部連携入口
- `features/`: ドメイン別UIとユースケース
- `lib/`: Cloudflare bindings、認証、DB、監査
- `workers/`: Queue consumer とバッチ処理
- `schemas/`: Zod schema

### 7.2 実装ルール

- DBアクセスは `Drizzle` 経由に統一する
- 入出力の境界は `Zod` で必ず検証する
- AIレスポンスは自由文のまま扱わず、必ず構造化JSONへ正規化する
- AIの判断結果だけで自動確定しない
- 仕訳確定には人手承認を必須にする

## 8. 開発環境構築方針

### 8.1 環境

- `local`: 開発者ローカル
- `preview`: PRごとの検証環境
- `staging`: 業務確認環境
- `production`: 本番環境

### 8.2 ローカル開発

- 基本起動: `next dev`
- Cloudflare resource 連携が必要なときは remote bindings を使う
- 画像アップロードやQueue投入など Cloudflare 固有機能は `wrangler` 設定込みで扱う

### 8.3 設定ファイル

- `wrangler.jsonc`
- `.dev.vars`
- `.env.local`
- `drizzle.config.ts`
- `next.config.ts`

## 9. 推奨開発フロー

### 9.1 ブランチ運用

- `main`: 常にデプロイ可能
- `develop` は作らない
- 機能開発は `feature/*`
- 不具合修正は `fix/*`
- 緊急修正は `hotfix/*`

小規模チームでは trunk-based に寄せた方が速い。長寿命ブランチは避ける。

### 9.2 チケット駆動

1. 要件を issue に分解する
2. 1 issue = 1 PR を原則にする
3. 受け入れ条件を先に書く
4. UI変更は画面単位、業務ロジック変更はユースケース単位で切る

### 9.3 実装の順序

1. Zod schema を定義
2. Drizzle schema と migration を定義
3. Server Action / Route Handler を実装
4. UI を実装
5. Queue consumer を実装
6. 監査ログとエラーハンドリングを追加
7. テストを書く

### 9.4 PRルール

- PRは小さく保つ
- UI変更はスクリーンショットを添付
- AI関連変更はプロンプト差分と期待JSONを記載
- D1 schema 変更時は migration を必須にする
- 監査・権限・税務ロジック変更はレビュー必須

## 10. CI/CDフロー

### 10.1 CI

GitHub Actions で以下を実行する。

1. `npm ci`
2. `npm run lint`
3. `npm run typecheck`
4. `npm run test`
5. `npm run build`

### 10.2 Preview

- PR作成時に preview 環境へデプロイ
- D1 は preview 用DBを使用
- R2 は preview バケットを使用
- AI Gateway は preview 用 gateway を使用

### 10.3 Staging

- `main` マージ後に staging へ自動デプロイ
- 業務テスト通過後に production へ昇格

### 10.4 Production

- Git tag または手動承認付き workflow でデプロイ
- DB migration は deploy 前後の順序を固定する
- ロールバック手順を事前に用意する

## 11. テスト戦略

### 11.1 単体テスト

- 対象: 税区分判定、科目候補整形、按分計算、承認ロジック
- ツール: `Vitest`

### 11.2 結合テスト

- 対象: Route Handlers、Server Actions、Drizzle repository
- 方針: 可能な限り Cloudflare binding をモック化

### 11.3 E2Eテスト

- 対象: ログイン、アップロード、AI解析完了、承認、CSV出力
- ツール: `Playwright`

### 11.4 AI評価テスト

- レシートサンプルセットを固定化する
- 金額、日付、店舗名、税率、勘定科目候補の正答率を計測する
- モデル変更時は回帰テストを必須にする

## 12. セキュリティ・運用ルール

- Gemini の API キーはクライアントに出さない
- AI呼び出しは必ずサーバー側で実行する
- R2 オブジェクトは原則 private にする
- 画像閲覧は署名付きURLまたは認可済み配信に限定する
- 顧問先データは tenant_id で必ず分離する
- 監査ログは作成、修正、承認、エクスポートで記録する
- 本番では個人情報を含むAIログの保存範囲を明示的に制御する

## 13. MVPの実装順

### Phase 1

- Next.js 基盤構築
- Cloudflare Workers デプロイ設定
- Auth
- D1 / R2 / Queues 接続

### Phase 2

- レシートアップロード
- AI解析ジョブ
- 抽出結果保存
- 確認画面

### Phase 3

- 仕訳候補生成
- 承認フロー
- CSV出力
- 監査ログ

### Phase 4

- 顧問先別ルール
- AI精度改善
- 会計ソフト連携

## 14. この案件での最終推奨

この案件では以下の構成を標準採用とする。

- Web: `Next.js 16 App Router`
- Runtime: `Cloudflare Workers` + `@opennextjs/cloudflare`
- DB: `Cloudflare D1`
- Storage: `Cloudflare R2`
- Async: `Cloudflare Queues`
- AI proxy: `Cloudflare AI Gateway`
- Model: `gemini-2.5-flash`
- ORM: `Drizzle ORM`
- Auth: `Auth.js`
- Validation: `Zod`
- Test: `Vitest` + `Playwright`
- CI/CD: `GitHub Actions` + `Wrangler`

この構成は、MVPを速く出しつつ、税理士事務所向けの監査性、証憑保管、承認フロー、将来の会計連携まで無理なく拡張できる。

## 15. 次に着手するもの

次の成果物はこの順で作る。

1. ディレクトリ構成
2. D1 スキーマ設計
3. `wrangler.jsonc` の初期設計
4. 認証方式の具体化
5. レシートアップロードから Queue 投入までの API 設計

## 16. 参照した一次情報

- Cloudflare Next.js on Workers: https://developers.cloudflare.com/workers/frameworks/framework-guides/nextjs/
- OpenNext for Cloudflare: https://opennext.js.org/cloudflare/get-started
- Cloudflare D1: https://developers.cloudflare.com/d1/get-started/
- Cloudflare R2 bindings: https://developers.cloudflare.com/r2/examples/demo-worker/
- Cloudflare Queues: https://developers.cloudflare.com/queues/get-started/
- Cloudflare AI Gateway Universal Endpoint: https://developers.cloudflare.com/ai-gateway/universal/
- Cloudflare Observability: https://developers.cloudflare.com/workers/observability/
- Cloudflare Workers Logs: https://developers.cloudflare.com/workers/observability/logs/workers-logs/
- Drizzle ORM and Cloudflare D1: https://orm.drizzle.team/docs/connect-cloudflare-d1
