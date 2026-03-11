export type AppBindings = {
  DB: D1Database;
  RECEIPTS_BUCKET: R2Bucket;
  EXTRACTION_QUEUE: Queue;
  APP_STAGE: string;
  AI_PROVIDER: string;
  UPLOAD_TOKEN_SECRET: string;
  MAX_UPLOAD_BYTES: string;
  AI_GATEWAY_BASE_URL: string;
  GEMINI_API_KEY: string;
};

declare global {
  interface CloudflareEnv extends AppBindings {}
}
