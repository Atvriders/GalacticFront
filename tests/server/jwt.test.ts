import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getUserMe, initJwt, initJwtFromJwk } from "../../src/server/jwt.js";
import * as jose from "jose";

function makeDevToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "EdDSA" })).toString(
    "base64url",
  );
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.fakesig`;
}

describe("jwt", () => {
  describe("dev mode (DEV_JWT=1)", () => {
    beforeEach(() => {
      vi.stubEnv("DEV_JWT", "1");
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("decodes a dev token without verification", async () => {
      const token = makeDevToken({
        sub: "user-123",
        username: "testplayer",
        email: "test@example.com",
      });
      const user = await getUserMe(token);
      expect(user.sub).toBe("user-123");
      expect(user.username).toBe("testplayer");
      expect(user.email).toBe("test@example.com");
    });

    it("uses sub as username when username is missing", async () => {
      const token = makeDevToken({ sub: "user-456" });
      const user = await getUserMe(token);
      expect(user.username).toBe("user-456");
    });

    it("uses preferred_username fallback", async () => {
      const token = makeDevToken({
        sub: "user-789",
        preferred_username: "pref_user",
      });
      const user = await getUserMe(token);
      expect(user.username).toBe("pref_user");
    });

    it("throws on invalid JWT format", async () => {
      await expect(getUserMe("not-a-jwt")).rejects.toThrow(
        "Invalid JWT format",
      );
    });

    it("throws when sub claim is missing", async () => {
      const token = makeDevToken({ username: "no-sub" });
      await expect(getUserMe(token)).rejects.toThrow("Missing sub claim");
    });
  });

  describe("EdDSA verification", () => {
    let privateKey: jose.CryptoKey;
    let publicKeyPem: string;

    beforeEach(async () => {
      const { publicKey, privateKey: pk } = await jose.generateKeyPair(
        "EdDSA",
      );
      privateKey = pk;
      publicKeyPem = await jose.exportSPKI(publicKey);
      await initJwt(publicKeyPem);
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("verifies a valid EdDSA JWT", async () => {
      const jwt = await new jose.SignJWT({
        sub: "real-user",
        username: "verified",
      })
        .setProtectedHeader({ alg: "EdDSA" })
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(privateKey);

      const user = await getUserMe(jwt);
      expect(user.sub).toBe("real-user");
      expect(user.username).toBe("verified");
    });

    it("rejects a tampered JWT", async () => {
      const jwt = await new jose.SignJWT({
        sub: "real-user",
        username: "verified",
      })
        .setProtectedHeader({ alg: "EdDSA" })
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(privateKey);

      // Tamper with the payload
      const parts = jwt.split(".");
      const tampered = `${parts[0]}.${Buffer.from('{"sub":"hacker"}').toString("base64url")}.${parts[2]}`;

      await expect(getUserMe(tampered)).rejects.toThrow();
    });

    it("rejects an expired JWT", async () => {
      const jwt = await new jose.SignJWT({
        sub: "real-user",
        username: "verified",
      })
        .setProtectedHeader({ alg: "EdDSA" })
        .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
        .sign(privateKey);

      await expect(getUserMe(jwt)).rejects.toThrow();
    });
  });
});
