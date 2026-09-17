// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  nitro: {
    // Target Vercel output format for deployment on Vercel
    preset: process.env.NITRO_PRESET || "vercel",
  },
  // Overrides the package's 8080 default. Has no effect inside Lovable's
  // sandbox (LOVABLE_SANDBOX=1 / DEV_SERVER__PROJECT_PATH set), which force
  // port 8080 regardless of this setting.
  vite: {
    server: { port: 3000 },
  },
});
