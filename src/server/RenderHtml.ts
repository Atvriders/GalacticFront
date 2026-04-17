export interface HtmlOptions {
  title?: string;
  gitCommit?: string;
  gameEnv?: string;
}

/**
 * Renders the main HTML shell with injected environment variables.
 */
export function renderHtml(options: HtmlOptions = {}): string {
  const {
    title = "GalacticFront",
    gitCommit = process.env.GIT_COMMIT ?? "dev",
    gameEnv = process.env.GAME_ENV ?? "production",
  } = options;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <script>
    window.__GIT_COMMIT__ = "${gitCommit}";
    window.__GAME_ENV__ = "${gameEnv}";
  </script>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/assets/index.js"></script>
</body>
</html>`;
}
