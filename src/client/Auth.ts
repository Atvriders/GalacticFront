/**
 * JWT authentication management.
 * Handles token decoding, auto-refresh, and persistent UUID fallback.
 */

import { decodeJwt } from "jose";

const TOKEN_KEY = "gf_auth_token";
const UUID_KEY = "gf_device_uuid";
const REFRESH_MARGIN_MS = 3 * 60 * 1000; // Refresh 3 minutes before expiry

export interface AuthToken {
  sub: string;
  exp: number;
  iat: number;
  name?: string;
  provider?: string;
}

let currentToken: string | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Decode a JWT without verification (client-side only).
 */
export function decodeToken(token: string): AuthToken {
  const payload = decodeJwt(token);
  return {
    sub: payload.sub ?? "",
    exp: (payload.exp as number) ?? 0,
    iat: (payload.iat as number) ?? 0,
    name: payload.name as string | undefined,
    provider: payload.provider as string | undefined,
  };
}

/**
 * Check if a token is expired.
 */
export function isTokenExpired(token: string): boolean {
  try {
    const decoded = decodeToken(token);
    return decoded.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

/**
 * Get or create a persistent UUID for anonymous identification.
 */
export function getDeviceUUID(): string {
  if (typeof localStorage === "undefined") return generateUUID();

  let uuid = localStorage.getItem(UUID_KEY);
  if (!uuid) {
    uuid = generateUUID();
    localStorage.setItem(UUID_KEY, uuid);
  }
  return uuid;
}

function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Store the current auth token and schedule refresh.
 */
export function setToken(token: string): void {
  currentToken = token;
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(TOKEN_KEY, token);
  }
  scheduleRefresh(token);
}

/**
 * Get the current auth token from memory or localStorage.
 */
export function getToken(): string | null {
  if (currentToken) return currentToken;
  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored && !isTokenExpired(stored)) {
      currentToken = stored;
      return stored;
    }
  }
  return null;
}

/**
 * Clear the current auth token.
 */
export function clearToken(): void {
  currentToken = null;
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
  }
  if (refreshTimer !== null) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

/**
 * Get an Authorization header value.
 */
export function getAuthHeader(): string | null {
  const token = getToken();
  if (!token) return null;
  return `Bearer ${token}`;
}

/**
 * Schedule token refresh 3 minutes before expiry.
 */
function scheduleRefresh(token: string): void {
  if (refreshTimer !== null) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }

  try {
    const decoded = decodeToken(token);
    const expiresAt = decoded.exp * 1000;
    const refreshAt = expiresAt - REFRESH_MARGIN_MS;
    const delay = refreshAt - Date.now();

    if (delay > 0) {
      refreshTimer = setTimeout(async () => {
        try {
          await refreshToken();
        } catch {
          clearToken();
        }
      }, delay);
    }
  } catch {
    // Invalid token, don't schedule
  }
}

/**
 * Refresh the token using the API.
 */
async function refreshToken(): Promise<void> {
  const token = getToken();
  if (!token) return;

  const base = getApiBase();
  const res = await fetch(`${base}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("Token refresh failed");
  }

  const data = (await res.json()) as { token: string };
  setToken(data.token);
}

/**
 * Redirect to Discord OAuth login.
 */
export function discordLogin(): void {
  const base = getApiBase();
  const returnUrl = encodeURIComponent(window.location.href);
  window.location.href = `${base}/auth/discord?returnUrl=${returnUrl}`;
}

/**
 * Login with a temporary token (for anonymous play).
 */
export async function tempTokenLogin(): Promise<string> {
  const uuid = getDeviceUUID();
  const base = getApiBase();
  const res = await fetch(`${base}/auth/temp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceID: uuid }),
  });

  if (!res.ok) {
    throw new Error("Temp token login failed");
  }

  const data = (await res.json()) as { token: string };
  setToken(data.token);
  return data.token;
}

/**
 * Get a play token for joining a game.
 */
export async function getPlayToken(gameID: string): Promise<string> {
  const base = getApiBase();
  const auth = getAuthHeader();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (auth) headers.Authorization = auth;

  const res = await fetch(`${base}/games/${gameID}/play-token`, {
    method: "POST",
    headers,
  });

  if (!res.ok) {
    throw new Error("Failed to get play token");
  }

  const data = (await res.json()) as { token: string };
  return data.token;
}

/**
 * Determine API base URL.
 */
function getApiBase(): string {
  if (typeof window === "undefined") return "http://localhost:3000/api";
  const loc = window.location;
  return `${loc.protocol}//${loc.host}/api`;
}
