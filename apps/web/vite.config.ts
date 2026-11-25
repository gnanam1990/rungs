import react from "@vitejs/plugin-react";
import { type Plugin, defineConfig, loadEnv } from "vite";

/** A strict Content-Security-Policy in the built page: no inline scripts, network only to the keeper. */
function csp(keeper: string): Plugin {
  const origin = new URL(keeper).origin;
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "font-src 'self'",
    "img-src 'self' data:",
    `connect-src 'self' ${origin}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");
  return {
    name: "rungs-csp",
    apply: "build",
    transformIndexHtml: (html) =>
      html.replace("<!--CSP-->", `<meta http-equiv="Content-Security-Policy" content="${policy}" />`),
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const keeper = env.VITE_KEEPER_URL || "http://localhost:8787";
  return {
    plugins: [react(), csp(keeper)],
    build: { target: "es2022", sourcemap: false },
    server: { port: 5173, strictPort: true },
  };
});
