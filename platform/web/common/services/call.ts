/*

Author : Rajveer Sharma
Date : 17 Nov 2026
@ Nxtwave

*/

import "server-only";
import type { SessionUser } from "@/common/auth/roles";
import { serviceConnected, type ServiceConfig } from "@/common/services/forward";
import { signIdentityToken } from "@/common/services/identity-token";

/**
 * Server-side call to a backend service as the signed-in person (server actions and
 * server components). Same identity token as the browser proxy in forward.ts.
 */
export type ServiceResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; error: string };

export async function callService<T>(
  service: ServiceConfig,
  user: SessionUser,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<ServiceResult<T>> {
  if (!serviceConnected(service)) {
    return { ok: false, status: 503, error: `The ${service.name} service isn't connected on this environment yet.` };
  }
  const origin = process.env[service.originEnv]!;
  const secret = process.env[service.secretEnv]!;
  const headers: Record<string, string> = {
    accept: "application/json",
    authorization: `Bearer ${await signIdentityToken(user, service.audience, secret)}`,
  };
  if (body !== undefined) headers["content-type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(new URL(`${service.upstreamPrefix}${path}`, origin), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return { ok: false, status: 502, error: `The ${service.name} service is starting up. Try again in a minute.` };
  }
  const data = (await res.json().catch(() => null)) as (T & { error?: unknown }) | null;
  if (!res.ok) {
    const message = data && typeof data.error === "string" ? data.error : `The ${service.name} service answered ${res.status}.`;
    return { ok: false, status: res.status, error: message };
  }
  return { ok: true, status: res.status, data: data as T };
}
