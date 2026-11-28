import path from "node:path";
import { defineConfig } from "vitest/config";

// Resolves the "@/..." alias from tsconfig.json so tests can import lib/.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      // Tests never load the real availability file or the debug sample
      // through the app's import; they pass data in explicitly.
      "availability-snapshot": path.resolve(__dirname, "lib/availability/no-data.json"),
      // Likewise the Live page's sample feed: tests pass feeds in explicitly.
      "live-sample-feed": path.resolve(__dirname, "lib/liveMatch/no-live-sample.json"),
    },
  },
  test: {
    // Tests that lock DEBUG_AS_OF_ROUND with vi.stubEnv never leak it.
    unstubEnvs: true,
  },
});
