import { defineConfig } from "vite";

/**
 * Local / Vercel / Netlify / Cloudflare: "/"
 * GitHub Pages project site: "/pullpocket-/" (set VITE_BASE_PATH in CI)
 */
const base = process.env.VITE_BASE_PATH || "/";

export default defineConfig({
  base,
});
