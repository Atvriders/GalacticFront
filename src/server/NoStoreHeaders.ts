import type { Request, Response, NextFunction } from "express";

/**
 * Middleware that sets no-store Cache-Control for API responses.
 * Prevents caching of dynamic API data.
 */
export function noStoreHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("Cache-Control", "no-store");
  next();
}
