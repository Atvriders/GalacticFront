// vite.config.ts
import { defineConfig } from "file:///home/kasm-user/GalacticFront/node_modules/vite/dist/node/index.js";
import tailwindcss from "file:///home/kasm-user/GalacticFront/node_modules/@tailwindcss/vite/dist/index.mjs";
import { resolve } from "path";
var __vite_injected_original_dirname = "/home/kasm-user/GalacticFront";
var vite_config_default = defineConfig({
  root: ".",
  server: {
    port: 9e3
  },
  build: {
    outDir: "static",
    emptyOutDir: true
  },
  plugins: [tailwindcss()],
  resolve: {
    alias: {
      "@core": resolve(__vite_injected_original_dirname, "src/core"),
      "@client": resolve(__vite_injected_original_dirname, "src/client")
    }
  },
  worker: {
    format: "es",
    rollupOptions: {
      output: {
        entryFileNames: "workers/[name]-[hash].js"
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9rYXNtLXVzZXIvR2FsYWN0aWNGcm9udFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL2hvbWUva2FzbS11c2VyL0dhbGFjdGljRnJvbnQvdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2hvbWUva2FzbS11c2VyL0dhbGFjdGljRnJvbnQvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHRhaWx3aW5kY3NzIGZyb20gXCJAdGFpbHdpbmRjc3Mvdml0ZVwiO1xuaW1wb3J0IHsgcmVzb2x2ZSB9IGZyb20gXCJwYXRoXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHJvb3Q6IFwiLlwiLFxuICBzZXJ2ZXI6IHtcbiAgICBwb3J0OiA5MDAwLFxuICB9LFxuICBidWlsZDoge1xuICAgIG91dERpcjogXCJzdGF0aWNcIixcbiAgICBlbXB0eU91dERpcjogdHJ1ZSxcbiAgfSxcbiAgcGx1Z2luczogW3RhaWx3aW5kY3NzKCldLFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgIFwiQGNvcmVcIjogcmVzb2x2ZShfX2Rpcm5hbWUsIFwic3JjL2NvcmVcIiksXG4gICAgICBcIkBjbGllbnRcIjogcmVzb2x2ZShfX2Rpcm5hbWUsIFwic3JjL2NsaWVudFwiKSxcbiAgICB9LFxuICB9LFxuICB3b3JrZXI6IHtcbiAgICBmb3JtYXQ6IFwiZXNcIixcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBvdXRwdXQ6IHtcbiAgICAgICAgZW50cnlGaWxlTmFtZXM6IFwid29ya2Vycy9bbmFtZV0tW2hhc2hdLmpzXCIsXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBeVEsU0FBUyxvQkFBb0I7QUFDdFMsT0FBTyxpQkFBaUI7QUFDeEIsU0FBUyxlQUFlO0FBRnhCLElBQU0sbUNBQW1DO0FBSXpDLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLE1BQU07QUFBQSxFQUNOLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxFQUNSO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxRQUFRO0FBQUEsSUFDUixhQUFhO0FBQUEsRUFDZjtBQUFBLEVBQ0EsU0FBUyxDQUFDLFlBQVksQ0FBQztBQUFBLEVBQ3ZCLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLFNBQVMsUUFBUSxrQ0FBVyxVQUFVO0FBQUEsTUFDdEMsV0FBVyxRQUFRLGtDQUFXLFlBQVk7QUFBQSxJQUM1QztBQUFBLEVBQ0Y7QUFBQSxFQUNBLFFBQVE7QUFBQSxJQUNOLFFBQVE7QUFBQSxJQUNSLGVBQWU7QUFBQSxNQUNiLFFBQVE7QUFBQSxRQUNOLGdCQUFnQjtBQUFBLE1BQ2xCO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
