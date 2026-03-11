import { extractReceiptWithGemini } from "@/lib/ai/gemini";
import { completeExtractionJob, failExtractionJob } from "@/lib/db/repository";
import { ExtractionQueueMessageSchema } from "@/types/queue/extraction";

type ConsumerEnv = {
  DB?: D1Database;
  RECEIPTS_BUCKET?: R2Bucket;
  AI_GATEWAY_BASE_URL?: string;
  GEMINI_API_KEY?: string;
  AI_GATEWAY_AUTH_TOKEN?: string;
};

const MAX_RETRY_ATTEMPTS = 3;

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return String(error);
}

async function processMessage(messageBody: unknown, env: ConsumerEnv): Promise<void> {
  const message = ExtractionQueueMessageSchema.parse(messageBody);

  if (!env.RECEIPTS_BUCKET) {
    throw new Error("RECEIPTS_BUCKET binding is not available");
  }

  if (!env.AI_GATEWAY_BASE_URL || !env.GEMINI_API_KEY) {
    throw new Error("AI gateway environment variables are missing");
  }

  const object = await env.RECEIPTS_BUCKET.get(message.objectKey);
  if (!object) {
    throw new Error(`Receipt object not found: ${message.objectKey}`);
  }

  const imageBytes = new Uint8Array(await object.arrayBuffer());
  const mimeType = object.httpMetadata?.contentType ?? "image/jpeg";

  const extracted = await extractReceiptWithGemini({
    imageBytes,
    mimeType,
    baseUrl: env.AI_GATEWAY_BASE_URL,
    apiKey: env.GEMINI_API_KEY,
    gatewayAuthToken: env.AI_GATEWAY_AUTH_TOKEN,
    contextText: `tenantId=${message.tenantId}; clientId=${message.clientId}`,
  });

  await completeExtractionJob({
    db: env.DB,
    jobId: message.id,
    receiptId: message.receiptId,
    extractedJson: JSON.stringify(extracted),
  });
}

const extractionConsumer = {
  async queue(batch: MessageBatch<unknown>, env: ConsumerEnv) {
    for (const msg of batch.messages) {
      const parsed = ExtractionQueueMessageSchema.safeParse(msg.body);
      const jobId = parsed.success ? parsed.data.id : String((msg.body as { id?: string })?.id ?? "");

      try {
        await processMessage(msg.body, env);
        msg.ack();
      } catch (error) {
        const errorText = toErrorMessage(error);
        console.error("[extraction-consumer] processing failed", {
          queueMessageId: msg.id,
          attempts: msg.attempts,
          jobId,
          error: errorText,
        });

        if (env.DB && jobId) {
          await failExtractionJob({ db: env.DB, jobId });
        }

        if (msg.attempts >= MAX_RETRY_ATTEMPTS) {
          console.error("[extraction-consumer] max attempts reached, acking message", {
            queueMessageId: msg.id,
            attempts: msg.attempts,
            jobId,
          });
          msg.ack();
        } else {
          msg.retry();
        }
      }
    }
  },
};

export default extractionConsumer;
