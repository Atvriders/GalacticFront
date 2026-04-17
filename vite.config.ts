import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

export default defineConfig({
  root: ".",
  server: {
    port: 9000,
  },
  build: {
    outDir: "static",
    emptyOutDir: true,
  },
  plugins: [tailwindcss()],
  resolve: {
    alias: {
      "@core": resolve(__dirname, "src/core"),
      "@client": resolve(__dirname, "src/client"),
    },
  },
  worker: {
    format: "es",
    rollupOptions: {
      output: {
        entryFileNames: "workers/[name]-[hash].js",
      },
    },
  },
});
