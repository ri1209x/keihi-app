import { getCloudflareContext } from "@opennextjs/cloudflare";

export type RuntimeBindings = {
  DB?: D1Database;
  RECEIPTS_BUCKET?: R2Bucket;
  EXTRACTION_QUEUE?: Queue;
  APP_STAGE?: string;
  AI_PROVIDER?: string;
  AUTH_SESSION_SECRET?: string;
  UPLOAD_TOKEN_SECRET?: string;
  MAX_UPLOAD_BYTES?: string;
  AI_GATEWAY_BASE_URL?: string;
  GEMINI_API_KEY?: string;
};

export async function getRuntimeBindings(): Promise<RuntimeBindings> {
  const envBindings: RuntimeBindings = {
    APP_STAGE: process.env.APP_STAGE,
    AI_PROVIDER: process.env.AI_PROVIDER,
    AUTH_SESSION_SECRET: process.env.AUTH_SESSION_SECRET,
    UPLOAD_TOKEN_SECRET: process.env.UPLOAD_TOKEN_SECRET,
    MAX_UPLOAD_BYTES: process.env.MAX_UPLOAD_BYTES,
    AI_GATEWAY_BASE_URL: process.env.AI_GATEWAY_BASE_URL,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  };

  try {
    const context = await getCloudflareContext({ async: true });
    return {
      ...(context.env as RuntimeBindings),
      ...Object.fromEntries(Object.entries(envBindings).filter(([, value]) => value != null)),
    };
  } catch {
    return envBindings;
  }
}
