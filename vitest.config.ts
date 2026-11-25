import path from "node:path";
import { defineConfig } from "vitest/config";

// Resolves the "@/..." alias from tsconfig.json so tests can import lib/.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
});
