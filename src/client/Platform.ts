// ---------------------------------------------------------------------------
// Platform – detect OS and device class
// ---------------------------------------------------------------------------

export interface PlatformInfo {
  isMac: boolean;
  isWindows: boolean;
  isLinux: boolean;
  isMobile: boolean; // width < 768
  isTablet: boolean; // 768 <= width < 1024
  isDesktop: boolean; // width >= 1024
}

function detect(): PlatformInfo {
  const ua =
    typeof navigator !== "undefined" ? navigator.userAgent.toLowerCase() : "";
  const width =
    typeof window !== "undefined" ? window.innerWidth : 1920;

  return {
    isMac: ua.includes("mac") && !ua.includes("iphone") && !ua.includes("ipad"),
    isWindows: ua.includes("win"),
    isLinux: ua.includes("linux") && !ua.includes("android"),
    isMobile: width < 768,
    isTablet: width >= 768 && width < 1024,
    isDesktop: width >= 1024,
  };
}

export const Platform: PlatformInfo = detect();
