/*

Author : Rajveer Sharma
Date : 15 Nov 2026
@ Nxtwave

*/

import "server-only";
import { getOptionalSessionUser } from "@/common/auth/session";
import { clientIp } from "@/common/auth/request";
import type { SessionUser } from "@/common/auth/roles";
import { signIdentityToken } from "@/common/services/identity-token";

/*
 * Generic same-origin proxy to a backend service. Each module declares its own
 * ServiceConfig (e.g. modules/attendance/service.ts); nothing here knows about modules.
 */

export type ServiceConfig = {
  /** Shown in error messages, e.g. "attendance". */
  name: string;
  /** JWT audience the service checks. */
  audience: string;
  originEnv: string;
  secretEnv: string;
  /** Path prefix on the service, e.g. "/api" so /api/attendance/x → {origin}/api/x. */
  upstreamPrefix: string;
  /**
   * Sample implementation of the same contract, used only when the service isn't
   * connected and sample services are allowed (development). Production never uses it.
   */
  sample?: (request: Request, path: string[], user: SessionUser) => Promise<Response>;
};

export function sampleServicesAllowed() {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_SAMPLE_SERVICES === "true";
}

/** Request headers passed through to the service; cookies and auth headers never are. */
const PASS_REQUEST = ["accept", "accept-language", "content-type", "if-none-match", "if-match"];
/** Response headers passed back to the browser. */
const PASS_RESPONSE = ["content-type", "content-disposition", "cache-control", "etag", "last-modified", "retry-after"];

function json(status: number, error: string) {
  return Response.json({ error }, { status, headers: { "cache-control": "no-store" } });
}

/**
 * Same-origin proxy: browser → /api/<service>/<path> → service, with the signed
 * identity token added. Keeps one domain, no CORS, and no service cookies.
 */
export async function forwardToService(request: Request, service: ServiceConfig, path: string[]): Promise<Response> {
  const user = await getOptionalSessionUser();
  if (!user) return json(401, "Not signed in");

  if (path.some((segment) => segment === "." || segment === ".." || segment === "")) {
    return json(400, "Invalid path");
  }

  const origin = process.env[service.originEnv];
  const secret = process.env[service.secretEnv];
  if (!origin || !secret) {
    if (service.sample && sampleServicesAllowed()) return service.sample(request, path, user);
    return json(503, `The ${service.name} service isn't connected on this environment yet.`);
  }

  const incoming = new URL(request.url);
  const target = new URL(`${service.upstreamPrefix}/${path.map(encodeURIComponent).join("/")}`, origin);
  target.search = incoming.search;

  const headers = new Headers();
  for (const name of PASS_REQUEST) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("authorization", `Bearer ${await signIdentityToken(user, service.audience, secret)}`);
  const ip = clientIp(request.headers);
  if (ip) headers.set("x-forwarded-for", ip);

  const hasBody = !["GET", "HEAD"].includes(request.method);
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return json(502, `The ${service.name} service didn't respond.`);
  }

  const out = new Headers();
  for (const name of PASS_RESPONSE) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }
  if (!out.has("cache-control")) out.set("cache-control", "private, no-store");
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

/** Whether a service's origin and secret are configured (otherwise the sample is used in development). */
export function serviceConnected(service: Pick<ServiceConfig, "originEnv" | "secretEnv">) {
  return !!(process.env[service.originEnv] && process.env[service.secretEnv]);
}
