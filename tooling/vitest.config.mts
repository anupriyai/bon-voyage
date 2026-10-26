import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL("../", import.meta.url));

export default defineConfig({
  root,
  // Same "@/…" root alias as tsconfig.json.
  resolve: { alias: { "@/": root } },
  test: {
    // .env.local supplies TEST_DATABASE_URL and friends; database tests skip without them.
    env: loadEnv("test", root, ""),
    // bon-voyage/ is an untracked older clone of this repo.
    exclude: ["**/node_modules/**", "bon-voyage/**"],
  },
});
