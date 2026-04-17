import * as jose from "jose";

export interface UserInfo {
  sub: string;
  username: string;
  email?: string;
}

let publicKey: jose.CryptoKey | null = null;

/**
 * Initialize the JWT verifier with an EdDSA public key (PEM or JWK).
 */
export async function initJwt(publicKeyPem: string): Promise<void> {
  publicKey = await jose.importSPKI(publicKeyPem, "EdDSA");
}

/**
 * Initialize from a JWK object.
 */
export async function initJwtFromJwk(
  jwk: jose.JWK,
): Promise<void> {
  publicKey = (await jose.importJWK(jwk, "EdDSA")) as jose.CryptoKey;
}

/**
 * Verify a JWT and return the user info.
 * In dev mode (DEV_JWT=1), skips signature verification and decodes the payload directly.
 */
export async function getUserMe(token: string): Promise<UserInfo> {
  if (process.env.DEV_JWT === "1") {
    return getDevUser(token);
  }

  if (!publicKey) {
    throw new Error("JWT not initialized. Call initJwt() first.");
  }

  const { payload } = await jose.jwtVerify(token, publicKey, {
    algorithms: ["EdDSA"],
  });

  return extractUser(payload);
}

/**
 * Dev-mode: decode without verification.
 */
function getDevUser(token: string): UserInfo {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }
  const payload = JSON.parse(
    Buffer.from(parts[1], "base64url").toString("utf-8"),
  );
  return extractUser(payload);
}

function extractUser(payload: Record<string, unknown>): UserInfo {
  const sub = payload.sub;
  if (typeof sub !== "string") {
    throw new Error("Missing sub claim");
  }
  const username =
    typeof payload.username === "string"
      ? payload.username
      : typeof payload.preferred_username === "string"
        ? payload.preferred_username
        : sub;

  const email =
    typeof payload.email === "string" ? payload.email : undefined;

  return { sub, username, email };
}
