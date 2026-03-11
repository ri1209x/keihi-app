const enc = new TextEncoder();

type UploadTokenPayload = {
  receiptId: string;
  objectKey: string;
  tenantId: string;
  clientId: string;
  exp: number;
};

function toBase64Url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function fromBase64Url(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

async function sign(input: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(input));
  return Buffer.from(signature).toString("base64url");
}

export async function createUploadToken(payload: UploadTokenPayload, secret: string): Promise<string> {
  const encoded = toBase64Url(JSON.stringify(payload));
  const signature = await sign(encoded, secret);
  return `${encoded}.${signature}`;
}

export async function verifyUploadToken(token: string, secret: string): Promise<UploadTokenPayload | null> {
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expected = await sign(encodedPayload, secret);
  if (signature !== expected) {
    return null;
  }

  try {
    const parsed = JSON.parse(fromBase64Url(encodedPayload)) as UploadTokenPayload;
    if (Date.now() > parsed.exp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
