export interface AuthUser {
  id: string;
  email: string;
}

export interface SessionResponse {
  user: AuthUser;
}

export interface Credentials {
  email: string;
  password: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
export const SOCKET_URL =
  process.env.NEXT_PUBLIC_WS_URL ?? API_URL.replace(/^http/, "ws");

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

let csrfToken: string | null = null;
let csrfPromise: Promise<string> | null = null;

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return requestOnce<T>(path, init, true);
}

async function requestOnce<T>(
  path: string,
  init: RequestInit | undefined,
  retryCsrf: boolean,
): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const mutating = !["GET", "HEAD", "OPTIONS"].includes(method);
  const csrf = mutating ? await ensureCsrfToken() : undefined;
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let message = "Something went wrong. Please try again.";
    let details: Record<string, unknown> | undefined;
    try {
      const body = (await response.json()) as {
        message?: string | string[];
        [key: string]: unknown;
      };
      if (Array.isArray(body.message)) message = body.message.join(" ");
      else if (body.message) message = body.message;
      details = body;
      if (response.status === 403 && body.code === "CSRF_INVALID") {
        csrfToken = null;
        if (mutating && retryCsrf) {
          return requestOnce<T>(path, init, false);
        }
      }
    } catch {
      // Keep the safe fallback for non-JSON errors.
    }
    throw new ApiError(message, response.status, details);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function ensureCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  csrfPromise ??= fetch(`${API_URL}/auth/csrf`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new ApiError(
          "Unable to initialize a secure Synk session.",
          response.status,
        );
      }
      const body = (await response.json()) as { token?: string };
      if (!body.token) {
        throw new ApiError("Synk did not return a security token.", 500);
      }
      csrfToken = body.token;
      return body.token;
    })
    .finally(() => {
      csrfPromise = null;
    });
  return csrfPromise;
}

export async function authenticatedRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  try {
    return await request<T>(path, init);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    refreshPromise ??= request<SessionResponse>("/auth/refresh", {
      method: "POST",
    }).finally(() => {
      refreshPromise = null;
    });
    await refreshPromise;
    return request<T>(path, init);
  }
}

let refreshPromise: Promise<SessionResponse> | null = null;

export async function getSession(): Promise<SessionResponse> {
  try {
    return await request<SessionResponse>("/auth/session");
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;

    refreshPromise ??= request<SessionResponse>("/auth/refresh", {
      method: "POST",
    }).finally(() => {
      refreshPromise = null;
    });
    await refreshPromise;
    return request<SessionResponse>("/auth/session");
  }
}

export function login(credentials: Credentials) {
  return request<SessionResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}

export function signup(credentials: Credentials) {
  return request<SessionResponse>("/auth/signup", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}

export function logout() {
  return request<void>("/auth/logout", { method: "POST" });
}

export function refreshOrganizerSession() {
  return request<SessionResponse>("/auth/refresh", { method: "POST" });
}
