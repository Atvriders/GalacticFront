import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  decodeToken,
  isTokenExpired,
  getDeviceUUID,
  setToken,
  getToken,
  clearToken,
  getAuthHeader,
} from "@client/Auth";

// Create a valid JWT for testing (header.payload.signature)
function makeJWT(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "none", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.`;
}

describe("Auth", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => {
        store[key] = val;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
    });
    clearToken();
  });

  it("should decode a JWT", () => {
    const token = makeJWT({
      sub: "user123",
      exp: 9999999999,
      iat: 1000000000,
      name: "TestUser",
    });

    const decoded = decodeToken(token);
    expect(decoded.sub).toBe("user123");
    expect(decoded.name).toBe("TestUser");
    expect(decoded.exp).toBe(9999999999);
  });

  it("should detect expired tokens", () => {
    const expired = makeJWT({ sub: "u", exp: 1, iat: 0 });
    expect(isTokenExpired(expired)).toBe(true);

    const valid = makeJWT({ sub: "u", exp: 9999999999, iat: 0 });
    expect(isTokenExpired(valid)).toBe(false);
  });

  it("should generate a persistent device UUID", () => {
    const uuid1 = getDeviceUUID();
    expect(uuid1).toBeTruthy();
    expect(uuid1.length).toBeGreaterThan(10);

    // Should return the same UUID on subsequent calls
    const uuid2 = getDeviceUUID();
    expect(uuid2).toBe(uuid1);
  });

  it("should store and retrieve tokens", () => {
    const token = makeJWT({ sub: "u", exp: 9999999999, iat: 0 });
    setToken(token);
    expect(getToken()).toBe(token);
  });

  it("should clear tokens", () => {
    const token = makeJWT({ sub: "u", exp: 9999999999, iat: 0 });
    setToken(token);
    clearToken();
    expect(getToken()).toBeNull();
  });

  it("should return auth header", () => {
    const token = makeJWT({ sub: "u", exp: 9999999999, iat: 0 });
    setToken(token);
    expect(getAuthHeader()).toBe(`Bearer ${token}`);
  });

  it("should return null auth header when no token", () => {
    expect(getAuthHeader()).toBeNull();
  });

  it("should not return expired tokens from getToken", () => {
    const expired = makeJWT({ sub: "u", exp: 1, iat: 0 });
    // Directly set in localStorage
    localStorage.setItem("gf_auth_token", expired);
    expect(getToken()).toBeNull();
  });
});
