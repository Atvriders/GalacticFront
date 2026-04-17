// ---------------------------------------------------------------------------
// Diagnostic – collect graphics and environment info
// ---------------------------------------------------------------------------

export interface GraphicsDiagnostics {
  browser: string;
  os: string;
  gpu: string;
  pixelRatio: number;
  softwareRendering: boolean;
}

export async function collectGraphicsDiagnostics(): Promise<GraphicsDiagnostics> {
  const ua =
    typeof navigator !== "undefined" ? navigator.userAgent : "unknown";
  const browser = parseBrowser(ua);
  const os = parseOS(ua);
  const pixelRatio =
    typeof window !== "undefined" ? window.devicePixelRatio ?? 1 : 1;

  let gpu = "unknown";
  let softwareRendering = false;

  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ??
      canvas.getContext("webgl") ??
      canvas.getContext("experimental-webgl");

    if (gl && gl instanceof WebGLRenderingContext) {
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      if (ext) {
        gpu = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string;
        softwareRendering =
          /swiftshader|llvmpipe|software/i.test(gpu);
      }
    }
  } catch {
    // No WebGL available
  }

  return { browser, os, gpu, pixelRatio, softwareRendering };
}

function parseBrowser(ua: string): string {
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Safari")) return "Safari";
  return "unknown";
}

function parseOS(ua: string): string {
  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Mac OS")) return "macOS";
  if (ua.includes("Linux")) return "Linux";
  if (ua.includes("Android")) return "Android";
  if (/iPhone|iPad/.test(ua)) return "iOS";
  return "unknown";
}
