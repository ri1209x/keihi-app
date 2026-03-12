import { headers } from "next/headers";

export async function getTenantHeader() {
  const h = await headers();
  return h.get("x-tenant-id") ?? "demo-tenant";
}

export async function getActorHeader() {
  const h = await headers();
  return h.get("x-user-id") ?? "operator";
}
