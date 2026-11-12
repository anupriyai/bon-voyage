import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL("../", import.meta.url));

export default defineConfig({
  root,
  // Same "@/…" root alias as tsconfig.json.
  resolve: { alias: { "@/": root } },
  test: {
    // The disposable database runner supplies all settings and must never read development secrets.
    // Otherwise .env.local supplies TEST_DATABASE_URL; database tests skip without those settings.
    env: process.env.BON_VOYAGE_ISOLATED_TESTS === "1" ? {} : loadEnv("test", root, ""),
    // bon-voyage/ is an untracked older clone of this repo.
    exclude: ["**/node_modules/**", "bon-voyage/**"],
  },
});
