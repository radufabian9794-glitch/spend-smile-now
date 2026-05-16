// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import checker from "vite-plugin-checker";

// In Docker / CI builds, skip vite-plugin-checker. Its TS + ESLint worker threads
// keep the Node process alive after `vite build` finishes, causing multi-minute
// hangs in TTY-less environments. Local dev still gets full IDE-style checking.
const isDockerBuild = process.env.DOCKER_BUILD === "1";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: isDockerBuild
      ? []
      : [
          checker({
            typescript: true,
            eslint: {
              lintCommand: 'eslint "./src/**/*.{ts,tsx}"',
              useFlatConfig: true,
            },
            overlay: { initialIsOpen: false },
            enableBuild: false,
          }),
        ],
  },
});
