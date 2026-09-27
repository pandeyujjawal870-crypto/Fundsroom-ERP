const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details: unknown = {}) {
    super(message);
  }
}

export const apiRequest = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const token = localStorage.getItem("fundsroom_access_token");
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  const body = (await response.json().catch(() => ({}))) as { success?: boolean; data?: T; error?: { code?: string; message?: string; details?: unknown } };
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event("fundsroom:unauthorized"));
    throw new ApiError(response.status, body.error?.code ?? "REQUEST_FAILED", body.error?.message ?? "The request could not be completed.", body.error?.details);
  }
  return body.data as T;
};
