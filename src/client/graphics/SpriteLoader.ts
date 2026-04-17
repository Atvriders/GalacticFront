/**
 * ImageBitmap-based sprite loader with caching and color tinting.
 */
export class SpriteLoader {
  /** Cache by URL. */
  private _cache = new Map<string, ImageBitmap>();
  /** Cache by url+color key for tinted variants. */
  private _tintCache = new Map<string, ImageBitmap>();
  /** In-flight loads to avoid duplicate fetches. */
  private _pending = new Map<string, Promise<ImageBitmap>>();

  /**
   * Load a sprite from a URL. Returns a cached copy if available.
   */
  async loadSprite(url: string): Promise<ImageBitmap> {
    const cached = this._cache.get(url);
    if (cached) return cached;

    const pending = this._pending.get(url);
    if (pending) return pending;

    const promise = this._fetchBitmap(url);
    this._pending.set(url, promise);

    try {
      const bitmap = await promise;
      this._cache.set(url, bitmap);
      return bitmap;
    } finally {
      this._pending.delete(url);
    }
  }

  /**
   * Create a tinted version of a sprite for empire colors.
   * Multiplies the sprite's RGB channels with the given color.
   */
  async colorize(url: string, color: string): Promise<ImageBitmap> {
    const key = `${url}:${color}`;
    const cached = this._tintCache.get(key);
    if (cached) return cached;

    const source = await this.loadSprite(url);

    // Draw source to offscreen canvas, apply tint via composite
    const canvas = new OffscreenCanvas(source.width, source.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get offscreen 2d context");

    // Draw original
    ctx.drawImage(source, 0, 0);

    // Apply color tint via multiply composite
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, source.width, source.height);

    // Restore alpha from original
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(source, 0, 0);

    const tinted = await createImageBitmap(canvas);
    this._tintCache.set(key, tinted);
    return tinted;
  }

  /** Check if a sprite is already cached. */
  has(url: string): boolean {
    return this._cache.has(url);
  }

  /** Clear all caches. */
  clear(): void {
    for (const bmp of this._cache.values()) bmp.close();
    for (const bmp of this._tintCache.values()) bmp.close();
    this._cache.clear();
    this._tintCache.clear();
    this._pending.clear();
  }

  private async _fetchBitmap(url: string): Promise<ImageBitmap> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load sprite: ${url} (${response.status})`);
    }
    const blob = await response.blob();
    return createImageBitmap(blob);
  }
}
