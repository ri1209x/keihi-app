import { z } from "zod";

const ReceiptExtractionSchema = z.object({
  storeName: z.string().nullable(),
  issuedDate: z.string().nullable(),
  totalAmount: z.number().nullable(),
  currency: z.string().nullable(),
  taxAmount: z.number().nullable(),
  taxRate: z.number().nullable(),
  paymentMethod: z.string().nullable(),
  summary: z.string(),
  suggestedAccount: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

export type ReceiptExtraction = z.infer<typeof ReceiptExtractionSchema>;

type ExtractInput = {
  imageBytes: Uint8Array;
  mimeType: string;
  contextText?: string;
  baseUrl: string;
  apiKey: string;
  gatewayAuthToken?: string;
};

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

function stripCodeFence(input: string): string {
  return input.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
}

function buildPrompt(contextText?: string): string {
  const base = [
    "You are an accounting assistant for Japanese expense processing.",
    "Extract receipt data and return only JSON.",
    "Schema:",
    "{",
    '  "storeName": string | null,',
    '  "issuedDate": string | null,',
    '  "totalAmount": number | null,',
    '  "currency": string | null,',
    '  "taxAmount": number | null,',
    '  "taxRate": number | null,',
    '  "paymentMethod": string | null,',
    '  "summary": string,',
    '  "suggestedAccount": string | null,',
    '  "confidence": number',
    "}",
    "Rules:",
    "- confidence is 0.0 to 1.0",
    "- If a field is unknown, use null",
    "- issuedDate must be ISO date string if available",
    "- Return no markdown, no prose",
  ];

  if (contextText) {
    base.push("Context:");
    base.push(contextText);
  }

  return base.join("\n");
}

function trimTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function resolveEndpoint(baseUrl: string): string {
  return `${trimTrailingSlash(baseUrl)}/v1beta/models/gemini-2.5-flash:generateContent`;
}

export async function extractReceiptWithGemini(input: ExtractInput): Promise<ReceiptExtraction> {
  const endpoint = resolveEndpoint(input.baseUrl);
  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          { text: buildPrompt(input.contextText) },
          {
            inlineData: {
              mimeType: input.mimeType,
              data: Buffer.from(input.imageBytes).toString("base64"),
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
    },
  };

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-goog-api-key": input.apiKey,
  };

  if (input.gatewayAuthToken) {
    headers.authorization = `Bearer ${input.gatewayAuthToken}`;
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini request failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as GeminiGenerateContentResponse;

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini response did not include text content");
  }

  const parsed = JSON.parse(stripCodeFence(text));
  return ReceiptExtractionSchema.parse(parsed);
}
