import type { Request, Response, NextFunction } from "express";

/**
 * Middleware that sets Cache-Control immutable for hashed static assets.
 * Assets containing a hash segment (e.g. app.a1b2c3.js) get long-lived caching.
 */
export function staticAssetCache(req: Request, res: Response, next: NextFunction): void {
  // Match filenames with hash patterns like: name.abc123.js or name.abc123.css
  const hashedAssetPattern = /\.[a-f0-9]{6,}\.(js|css)$/;

  if (hashedAssetPattern.test(req.path)) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  }

  next();
}
