/*

Author : Rajveer Sharma
Date : 14 Nov 2026
@ Nxtwave

*/

/**
 * Browser-side fetch wrapper for the app's own API routes
 * (/api/core/*, /api/logs/*, /api/attendance/*, /api/contest/*).
 * One error shape everywhere; a 401 sends the user back to sign in.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** The Go services' error details, e.g. { field: message } on a 422 validation_failed. */
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const response = await fetch(path, {
    ...rest,
    credentials: "same-origin",
    headers: {
      accept: "application/json",
      ...(json !== undefined ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  if (response.status === 401 && typeof window !== "undefined") {
    // Deliberate full reload: the session ended, so drop every cached query and client state.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    let details: unknown;
    try {
      // Shapes used by our routes ({error}), the Go service ({error: {message, details}}) and FastAPI ({detail}).
      const body = (await response.json()) as { error?: string | { message?: string; details?: unknown }; message?: string; detail?: string };
      const fromError = typeof body.error === "string" ? body.error : body.error?.message;
      message = fromError ?? body.message ?? body.detail ?? message;
      if (body.error && typeof body.error === "object") details = body.error.details;
    } catch {
      // not JSON; keep the generic message
    }
    throw new ApiError(response.status, message, details);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
