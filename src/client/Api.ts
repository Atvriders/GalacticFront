/**
 * REST API client for GalacticFront server.
 */

import { getAuthHeader } from "./Auth.js";

// ── Types ──────────────────────────────────────────────────────────────────

export interface UserMe {
  id: string;
  name: string;
  provider: string;
  createdAt: string;
}

export interface PlayerInfo {
  id: string;
  name: string;
  gamesPlayed: number;
  wins: number;
}

export interface NewsItem {
  id: string;
  title: string;
  body: string;
  date: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ── Cache ──────────────────────────────────────────────────────────────────

let cachedUser: UserMe | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 1 minute

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Get the API base URL.
 */
export function getApiBase(): string {
  if (typeof window === "undefined") return "http://localhost:3000/api";
  const loc = window.location;
  return `${loc.protocol}//${loc.host}/api`;
}

/**
 * Generic fetch wrapper with auth and error handling.
 */
async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const base = getApiBase();
  const url = `${base}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  const auth = getAuthHeader();
  if (auth) {
    headers.Authorization = auth;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let message = `API error: ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // Use default message
    }
    throw new ApiError(res.status, message);
  }

  // Handle 204 No Content
  if (res.status === 204) {
    return undefined as unknown as T;
  }

  return (await res.json()) as T;
}

// ── API Methods ────────────────────────────────────────────────────────────

/**
 * Get the current user's profile. Cached for 1 minute.
 */
export async function getUserMe(forceRefresh = false): Promise<UserMe> {
  if (
    !forceRefresh &&
    cachedUser &&
    Date.now() - cacheTimestamp < CACHE_TTL_MS
  ) {
    return cachedUser;
  }

  cachedUser = await apiFetch<UserMe>("/users/me");
  cacheTimestamp = Date.now();
  return cachedUser;
}

/**
 * Clear the user cache.
 */
export function clearUserCache(): void {
  cachedUser = null;
  cacheTimestamp = 0;
}

/**
 * Get a player's public profile.
 */
export async function getPlayer(id: string): Promise<PlayerInfo> {
  return apiFetch<PlayerInfo>(`/players/${id}`);
}

/**
 * Get news/announcements.
 */
export async function getNews(): Promise<NewsItem[]> {
  return apiFetch<NewsItem[]>("/news");
}

/**
 * Generic GET request.
 */
export async function apiGet<T>(path: string): Promise<T> {
  return apiFetch<T>(path);
}

/**
 * Generic POST request.
 */
export async function apiPost<T>(
  path: string,
  body?: unknown,
): Promise<T> {
  return apiFetch<T>(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}
