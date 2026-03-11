import { getCloudflareContext } from "@opennextjs/cloudflare";

export type RuntimeBindings = {
  DB?: D1Database;
  RECEIPTS_BUCKET?: R2Bucket;
  EXTRACTION_QUEUE?: Queue;
  APP_STAGE?: string;
  AI_PROVIDER?: string;
  UPLOAD_TOKEN_SECRET?: string;
  MAX_UPLOAD_BYTES?: string;
  AI_GATEWAY_BASE_URL?: string;
  GEMINI_API_KEY?: string;
};

export async function getRuntimeBindings(): Promise<RuntimeBindings> {
  try {
    const context = await getCloudflareContext({ async: true });
    return context.env as RuntimeBindings;
  } catch {
    return {
      APP_STAGE: process.env.APP_STAGE,
      AI_PROVIDER: process.env.AI_PROVIDER,
      UPLOAD_TOKEN_SECRET: process.env.UPLOAD_TOKEN_SECRET,
      MAX_UPLOAD_BYTES: process.env.MAX_UPLOAD_BYTES,
      AI_GATEWAY_BASE_URL: process.env.AI_GATEWAY_BASE_URL,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    };
  }
}
