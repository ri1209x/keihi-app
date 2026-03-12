import { NextResponse } from "next/server";
import { z } from "zod";
import { getDemoUserById, listDemoUsers } from "@/lib/auth/demo-users";
import { clearSessionCookie, getCurrentSession, setSessionCookie } from "@/lib/auth/session";
import { getRuntimeBindings } from "@/lib/cloudflare/context";

const SignInSchema = z.object({
  userId: z.string().min(1),
});

export async function GET() {
  const bindings = await getRuntimeBindings();
  const session = await getCurrentSession(bindings);

  return NextResponse.json({
    session,
    users: listDemoUsers(),
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = SignInSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 });
  }

  const user = getDemoUserById(parsed.data.userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const bindings = await getRuntimeBindings();
  await setSessionCookie(user, bindings);

  return NextResponse.json({
    signedIn: true,
    session: user,
  });
}

export async function DELETE() {
  await clearSessionCookie();
  return NextResponse.json({ signedOut: true });
}
