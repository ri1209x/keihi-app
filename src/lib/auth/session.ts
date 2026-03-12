import { cookies } from "next/headers";
import { z } from "zod";
import { getDemoUserById, type AppRole, type DemoUser } from "@/lib/auth/demo-users";
import type { RuntimeBindings } from "@/lib/cloudflare/context";

const enc = new TextEncoder();
const SESSION_COOKIE_NAME = "keihi_auth_session";
const SESSION_TTL_SEC = 60 * 60 * 8;
const ROLES = ["operator", "approver", "admin"] as const;

const SessionTokenSchema = z.object({
  userId: z.string().min(1),
  organizationId: z.string().min(1),
  role: z.enum(ROLES),
  exp: z.number().int().positive(),
});

type SessionToken = z.infer<typeof SessionTokenSchema>;

export type AppSession = DemoUser;

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

function getAuthSecret(bindings: RuntimeBindings): string | null {
  return bindings.AUTH_SESSION_SECRET ?? bindings.UPLOAD_TOKEN_SECRET ?? null;
}

function toSession(user: DemoUser): AppSession {
  return {
    id: user.id,
    displayName: user.displayName,
    organizationId: user.organizationId,
    role: user.role,
    defaultClientId: user.defaultClientId,
  };
}

export async function createSessionToken(user: DemoUser, bindings: RuntimeBindings): Promise<string> {
  const secret = getAuthSecret(bindings);
  if (!secret) {
    throw new Error("AUTH_SESSION_SECRET or UPLOAD_TOKEN_SECRET is not configured");
  }

  const payload: SessionToken = {
    userId: user.id,
    organizationId: user.organizationId,
    role: user.role,
    exp: Date.now() + SESSION_TTL_SEC * 1000,
  };
  const encoded = toBase64Url(JSON.stringify(payload));
  const signature = await sign(encoded, secret);
  return `${encoded}.${signature}`;
}

export async function verifySessionToken(token: string, bindings: RuntimeBindings): Promise<AppSession | null> {
  const secret = getAuthSecret(bindings);
  if (!secret) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expected = await sign(encodedPayload, secret);
  if (expected !== signature) {
    return null;
  }

  try {
    const parsed = SessionTokenSchema.parse(JSON.parse(fromBase64Url(encodedPayload)));
    if (Date.now() > parsed.exp) {
      return null;
    }

    const user = getDemoUserById(parsed.userId);
    if (!user || user.organizationId !== parsed.organizationId || user.role !== parsed.role) {
      return null;
    }

    return toSession(user);
  } catch {
    return null;
  }
}

export async function getCurrentSession(bindings: RuntimeBindings): Promise<AppSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  return verifySessionToken(token, bindings);
}

export async function setSessionCookie(user: DemoUser, bindings: RuntimeBindings): Promise<void> {
  const cookieStore = await cookies();
  const token = await createSessionToken(user, bindings);
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SEC,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function hasRequiredRole(role: AppRole, allowedRoles: AppRole[]): boolean {
  return role === "admin" || allowedRoles.includes(role);
}

export function canAccessOrganization(session: AppSession, organizationId: string): boolean {
  return session.organizationId === organizationId;
}
