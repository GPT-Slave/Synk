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

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
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
    } catch {
      // Keep the safe fallback for non-JSON errors.
    }
    throw new ApiError(message, response.status, details);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
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
