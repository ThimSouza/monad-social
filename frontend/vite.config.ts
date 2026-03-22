import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Dev: proxy /hasura → Hasura (local Docker or remote EC2). No CORS in the browser.
  const hasuraProxyTarget =
    env.INDEXER_HASURA_URL?.trim() || "http://127.0.0.1:8080";

  return {
    server: {
      host: true,
      port: 5173,
      strictPort: false,
      hmr: {
        overlay: true,
      },
      proxy: {
        "/hasura": {
          target: hasuraProxyTarget,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/hasura/, ""),
        },
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
